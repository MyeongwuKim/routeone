import CoreLocation
import ExpoModulesCore
import Foundation
import UserNotifications

private let routeArrivalNotificationType = "route-arrival"
private let minimumRouteArrivalMonitoringRadiusMeters = 300.0
private let maximumRouteArrivalMonitoringRadiusMeters = 700.0
private let routeArrivalNotificationLedgerKey = "routeone:arrival-notification-ledger:v1"
private let routeArrivalNotificationOperationGate = RouteArrivalNotificationOperationGate()

private struct RouteArrivalNotificationRecord: Record {
  @Field
  var identifier: String

  @Field
  var regionIdentifier: String

  @Field
  var title: String

  @Field
  var body: String

  @Field
  var routeId: String

  @Field
  var routeTitle: String?

  @Field
  var dayId: String

  @Field
  var stopId: String

  @Field
  var placeTitle: String

  @Field
  var dateKey: String

  @Field
  var latitude: Double

  @Field
  var longitude: Double

  @Field
  var radiusMeters: Double?
}

private struct RouteArrivalNotificationStatusRecord: Record {
  @Field
  var pendingIdentifiers: [String] = []

  @Field
  var deliveredIdentifiers: [String] = []

  @Field
  var handledIdentifiers: [String] = []
}

private struct RouteArrivalNotificationSnapshot {
  let pendingRequests: [UNNotificationRequest]
  let deliveredIdentifiers: Set<String>

  var pendingIdentifiers: Set<String> {
    Set(pendingRequests.map(\.identifier))
  }

  var oneShotPendingIdentifiers: Set<String> {
    Set(pendingRequests.filter { $0.trigger?.repeats != true }.map(\.identifier))
  }
}

public final class RouteArrivalNotificationsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RouteArrivalNotifications")

    AsyncFunction("syncAsync") {
      (notifications: [RouteArrivalNotificationRecord], radiusMeters: Double) async throws -> Int in
      try await routeArrivalNotificationOperationGate.withLock {
        try await self.syncNotifications(notifications, radiusMeters: radiusMeters)
      }
    }

    AsyncFunction("getStatusAsync") { () async throws -> RouteArrivalNotificationStatusRecord in
      try await routeArrivalNotificationOperationGate.withLock {
        let snapshot = await self.notificationSnapshot(UNUserNotificationCenter.current())
        let ledger = try self.reconciledLedger(for: snapshot)
        let status = RouteArrivalNotificationStatusRecord()
        status.pendingIdentifiers = Array(snapshot.pendingIdentifiers).sorted()
        status.deliveredIdentifiers = Array(snapshot.deliveredIdentifiers).sorted()
        status.handledIdentifiers = Array(ledger.handledIdentifiers).sorted()
        return status
      }
    }
  }

  private func syncNotifications(
    _ notifications: [RouteArrivalNotificationRecord],
    radiusMeters: Double
  ) async throws -> Int {
    let center = UNUserNotificationCenter.current()
    let snapshot = await notificationSnapshot(center)
    var ledger = try reconciledLedger(for: snapshot)
    let locationPendingRequests = snapshot.pendingRequests.filter {
      $0.trigger is UNLocationNotificationTrigger
    }
    let preservedImmediateIdentifiers = Set(
      snapshot.pendingRequests
        .filter {
          !($0.trigger is UNLocationNotificationTrigger) &&
            ledger.canPreservePending($0.identifier)
        }
        .map(\.identifier)
    )
    var notificationsByIdentifier: [String: RouteArrivalNotificationRecord] = [:]
    for notification in notifications {
      notificationsByIdentifier[notification.identifier] = notification
    }
    let expectedIdentifiers = Set(notificationsByIdentifier.keys)
    let preservedLocationIdentifiers = Set<String>(
      locationPendingRequests.compactMap { request in
        guard
          ledger.canPreservePending(request.identifier),
          let notification = notificationsByIdentifier[request.identifier]
        else {
          return nil
        }

        let monitoredRadius = self.monitoredRadius(
          for: notification,
          fallback: radiusMeters
        )
        guard matches(
          request,
          notification: notification,
          monitoredRadius: monitoredRadius
        ) else {
          return nil
        }

        return request.identifier
      }
    )
    let staleLocationIdentifiers = Set(locationPendingRequests.map(\.identifier))
      .subtracting(preservedLocationIdentifiers)

    if !staleLocationIdentifiers.isEmpty {
      ledger.recordCancellation(
        staleLocationIdentifiers,
        pendingIdentifiers: snapshot.pendingIdentifiers
      )
      // Keep this marker before the OS removal, which has no completion callback.
      try saveLedger(ledger)
      center.removePendingNotificationRequests(withIdentifiers: Array(staleLocationIdentifiers))
    }

    for identifier in expectedIdentifiers.sorted()
    where ledger.canRegister(identifier) &&
      !preservedImmediateIdentifiers.contains(identifier) &&
      !preservedLocationIdentifiers.contains(identifier) {
      guard let notification = notificationsByIdentifier[identifier] else {
        continue
      }

      let request = notificationRequest(
        notification,
        monitoredRadius: monitoredRadius(for: notification, fallback: radiusMeters)
      )
      try await center.add(request)
      ledger.recordSuccessfulRegistration(identifier)
      try saveLedger(ledger)
    }

    let registeredSnapshot = await notificationSnapshot(center)
    ledger.reconcile(
      pendingIdentifiers: registeredSnapshot.pendingIdentifiers,
      deliveredIdentifiers: registeredSnapshot.deliveredIdentifiers,
      adoptablePendingIdentifiers: registeredSnapshot.oneShotPendingIdentifiers
    )
    try saveLedger(ledger)

    // An accepted one-shot request may already have fired and been dismissed.
    // Its absence from both OS lists must not cause another add with the same ID.
    let registeredIdentifiers = registeredSnapshot.pendingIdentifiers
      .union(ledger.handledIdentifiers)
    guard expectedIdentifiers.isSubset(of: registeredIdentifiers) else {
      throw NSError(
        domain: "RouteArrivalNotifications",
        code: 1,
        userInfo: [
          NSLocalizedDescriptionKey:
            "iOS가 장소 도착 알림을 등록하지 못했어요. 앱을 다시 열어 주세요."
        ]
      )
    }

    return expectedIdentifiers.count
  }

  private func monitoredRadius(
    for notification: RouteArrivalNotificationRecord,
    fallback: Double
  ) -> Double {
    let requestedRadius = notification.radiusMeters ?? fallback

    return max(
      minimumRouteArrivalMonitoringRadiusMeters,
      min(maximumRouteArrivalMonitoringRadiusMeters, requestedRadius.rounded())
    )
  }

  private func notificationRequest(
    _ notification: RouteArrivalNotificationRecord,
    monitoredRadius: Double
  ) -> UNNotificationRequest {
    let content = UNMutableNotificationContent()
    content.title = notification.title
    content.body = notification.body
    content.sound = .default
    content.threadIdentifier = "route-arrivals"
    content.userInfo = [
      "notificationId": notification.identifier,
      "type": routeArrivalNotificationType,
      "routeId": notification.routeId,
      "routeTitle": notification.routeTitle ?? "",
      "dayId": notification.dayId,
      "stopId": notification.stopId,
      "placeTitle": notification.placeTitle,
      "dateKey": notification.dateKey
    ]

    let coordinate = CLLocationCoordinate2D(
      latitude: notification.latitude,
      longitude: notification.longitude
    )
    let region = CLCircularRegion(
      center: coordinate,
      radius: monitoredRadius,
      identifier: notification.regionIdentifier
    )
    region.notifyOnEntry = true
    region.notifyOnExit = false

    return UNNotificationRequest(
      identifier: notification.identifier,
      content: content,
      trigger: UNLocationNotificationTrigger(region: region, repeats: false)
    )
  }

  private func notificationSnapshot(
    _ center: UNUserNotificationCenter
  ) async -> RouteArrivalNotificationSnapshot {
    let pendingRequests = await center.pendingNotificationRequests()
    let deliveredNotifications = await center.deliveredNotifications()
    return RouteArrivalNotificationSnapshot(
      pendingRequests: pendingRequests.filter { isRouteArrivalNotification($0.content) },
      deliveredIdentifiers: Set(
        deliveredNotifications
          .filter { isRouteArrivalNotification($0.request.content) }
          .map { $0.request.identifier }
      )
    )
  }

  private func reconciledLedger(
    for snapshot: RouteArrivalNotificationSnapshot
  ) throws -> RouteArrivalNotificationLedger {
    var ledger: RouteArrivalNotificationLedger
    if let data = UserDefaults.standard.data(forKey: routeArrivalNotificationLedgerKey) {
      ledger = try JSONDecoder().decode(RouteArrivalNotificationLedger.self, from: data)
    } else {
      ledger = RouteArrivalNotificationLedger()
    }

    ledger.reconcile(
      pendingIdentifiers: snapshot.pendingIdentifiers,
      deliveredIdentifiers: snapshot.deliveredIdentifiers,
      adoptablePendingIdentifiers: snapshot.oneShotPendingIdentifiers
    )
    try saveLedger(ledger)
    return ledger
  }

  private func saveLedger(_ ledger: RouteArrivalNotificationLedger) throws {
    let data = try JSONEncoder().encode(ledger)
    UserDefaults.standard.set(data, forKey: routeArrivalNotificationLedgerKey)
  }

  private func isRouteArrivalNotification(
    _ content: UNNotificationContent
  ) -> Bool {
    content.userInfo["type"] as? String == routeArrivalNotificationType
  }

  private func matches(
    _ request: UNNotificationRequest,
    notification: RouteArrivalNotificationRecord,
    monitoredRadius: Double
  ) -> Bool {
    guard
      let trigger = request.trigger as? UNLocationNotificationTrigger,
      let region = trigger.region as? CLCircularRegion
    else {
      return false
    }

    let coordinateMatches =
      abs(region.center.latitude - notification.latitude) < 0.000_001 &&
      abs(region.center.longitude - notification.longitude) < 0.000_001
    let contentMatches =
      request.content.title == notification.title &&
      request.content.body == notification.body &&
      (request.content.userInfo["notificationId"] as? String) == notification.identifier &&
      (request.content.userInfo["type"] as? String) == routeArrivalNotificationType &&
      (request.content.userInfo["routeId"] as? String) == notification.routeId &&
      (request.content.userInfo["routeTitle"] as? String) == (notification.routeTitle ?? "") &&
      (request.content.userInfo["dayId"] as? String) == notification.dayId &&
      (request.content.userInfo["stopId"] as? String) == notification.stopId &&
      (request.content.userInfo["placeTitle"] as? String) == notification.placeTitle &&
      (request.content.userInfo["dateKey"] as? String) == notification.dateKey

    return
      !trigger.repeats &&
      region.identifier == notification.regionIdentifier &&
      coordinateMatches &&
      abs(region.radius - monitoredRadius) < 0.5 &&
      region.notifyOnEntry &&
      !region.notifyOnExit &&
      contentMatches
  }
}
