import CoreLocation
import ExpoModulesCore
import UserNotifications

private let routeArrivalNotificationType = "route-arrival"

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
}

private struct RouteArrivalNotificationStatusRecord: Record {
  @Field
  var pendingIdentifiers: [String] = []

  @Field
  var deliveredIdentifiers: [String] = []
}

public final class RouteArrivalNotificationsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RouteArrivalNotifications")

    AsyncFunction("syncAsync") {
      (notifications: [RouteArrivalNotificationRecord], radiusMeters: Double) async throws -> Int in
      let center = UNUserNotificationCenter.current()
      let managedPendingIdentifiers = await self.pendingIdentifiers(center)

      if !managedPendingIdentifiers.isEmpty {
        center.removePendingNotificationRequests(
          withIdentifiers: Array(managedPendingIdentifiers)
        )
      }

      guard !notifications.isEmpty else {
        return 0
      }

      let deliveredNotifications = await center.deliveredNotifications()
      let deliveredIdentifiers = Set(
        deliveredNotifications
          .filter { self.isRouteArrivalNotification($0.request.content) }
          .map { $0.request.identifier }
      )
      let radius = max(300, min(500, radiusMeters.rounded()))
      var requestsByIdentifier: [String: UNNotificationRequest] = [:]

      for notification in notifications where !deliveredIdentifiers.contains(notification.identifier) {
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
          radius: radius,
          identifier: notification.regionIdentifier
        )
        region.notifyOnEntry = true
        region.notifyOnExit = false

        let trigger = UNLocationNotificationTrigger(
          region: region,
          repeats: false
        )
        let request = UNNotificationRequest(
          identifier: notification.identifier,
          content: content,
          trigger: trigger
        )

        requestsByIdentifier[notification.identifier] = request
        try await center.add(request)
      }

      let expectedIdentifiers = Set(requestsByIdentifier.keys)
      var registeredIdentifiers = await self.pendingIdentifiers(center)
      var missingIdentifiers = expectedIdentifiers.subtracting(registeredIdentifiers)

      if !missingIdentifiers.isEmpty {
        for identifier in missingIdentifiers.sorted() {
          if let request = requestsByIdentifier[identifier] {
            try await center.add(request)
          }
        }

        registeredIdentifiers = await self.pendingIdentifiers(center)
        missingIdentifiers = expectedIdentifiers.subtracting(registeredIdentifiers)
      }

      guard missingIdentifiers.isEmpty else {
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

    AsyncFunction("getStatusAsync") { () async -> RouteArrivalNotificationStatusRecord in
      let center = UNUserNotificationCenter.current()
      let status = RouteArrivalNotificationStatusRecord()
      status.pendingIdentifiers = Array(await self.pendingIdentifiers(center)).sorted()
      status.deliveredIdentifiers = Array(await self.deliveredIdentifiers(center)).sorted()
      return status
    }
  }

  private func pendingIdentifiers(
    _ center: UNUserNotificationCenter
  ) async -> Set<String> {
    let pendingRequests = await center.pendingNotificationRequests()
    return Set(
      pendingRequests
        .filter { self.isRouteArrivalNotification($0.content) }
        .map(\.identifier)
    )
  }

  private func deliveredIdentifiers(
    _ center: UNUserNotificationCenter
  ) async -> Set<String> {
    let deliveredNotifications = await center.deliveredNotifications()
    return Set(
      deliveredNotifications
        .filter { self.isRouteArrivalNotification($0.request.content) }
        .map { $0.request.identifier }
    )
  }

  private func isRouteArrivalNotification(
    _ content: UNNotificationContent
  ) -> Bool {
    content.userInfo["type"] as? String == routeArrivalNotificationType
  }
}
