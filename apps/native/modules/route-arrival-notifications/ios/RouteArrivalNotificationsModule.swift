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

public final class RouteArrivalNotificationsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RouteArrivalNotifications")

    AsyncFunction("syncAsync") {
      (notifications: [RouteArrivalNotificationRecord], radiusMeters: Double) async throws -> Int in
      let center = UNUserNotificationCenter.current()
      let pendingRequests = await center.pendingNotificationRequests()
      let managedPendingIdentifiers = pendingRequests
        .filter { self.isRouteArrivalNotification($0.content) }
        .map(\.identifier)

      if !managedPendingIdentifiers.isEmpty {
        center.removePendingNotificationRequests(
          withIdentifiers: managedPendingIdentifiers
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
      var activeCount = 0

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

        try await center.add(request)
        activeCount += 1
      }

      return activeCount
    }
  }

  private func isRouteArrivalNotification(
    _ content: UNNotificationContent
  ) -> Bool {
    content.userInfo["type"] as? String == routeArrivalNotificationType
  }
}
