import Foundation

private let notificationId = "arrival:route-a:stop-a:2026-08-28"

private enum TestFailure: Error {
  case assertion(String)
  case registrationRejected
}

private func expect(_ condition: @autoclosure () -> Bool, _ message: String) throws {
  guard condition() else {
    throw TestFailure.assertion(message)
  }
}

private func reload(
  _ ledger: RouteArrivalNotificationLedger
) throws -> RouteArrivalNotificationLedger {
  try JSONDecoder().decode(
    RouteArrivalNotificationLedger.self,
    from: JSONEncoder().encode(ledger)
  )
}

private actor TestLatch {
  private var isOpen = false
  private var waiters: [CheckedContinuation<Void, Never>] = []

  func wait() async {
    guard !isOpen else {
      return
    }

    await withCheckedContinuation { waiters.append($0) }
  }

  func open() {
    isOpen = true
    let waiting = waiters
    waiters.removeAll()
    waiting.forEach { $0.resume() }
  }
}

private actor OperationProbe {
  private var activeCount = 0
  private(set) var maximumActiveCount = 0
  private(set) var completedCount = 0

  func enter() {
    activeCount += 1
    maximumActiveCount = max(maximumActiveCount, activeCount)
  }

  func leave() {
    activeCount -= 1
    completedCount += 1
  }
}

private actor RegistrationState {
  private var ledger = RouteArrivalNotificationLedger()
  private var pendingIdentifiers: Set<String> = []
  private(set) var statusReads = 0

  func acceptRegistration() {
    pendingIdentifiers.insert(notificationId)
    ledger.recordSuccessfulRegistration(notificationId)
  }

  func readStatus() -> RouteArrivalNotificationLedger {
    statusReads += 1
    ledger.reconcile(pendingIdentifiers: pendingIdentifiers, deliveredIdentifiers: [])
    return ledger
  }
}

@main
private struct RouteArrivalNotificationLedgerTests {
  static func main() async throws {
    let tests: [(String, () async throws -> Void)] = [
      ("dismissed arrival stays handled after app restart", dismissedArrival),
      ("accepted request disappearing immediately is not retried", immediatelyConsumed),
      ("existing one-shot pending is adopted on upgrade", adoptPending),
      ("actual delivered notification is remembered after dismissal", adoptDelivered),
      ("pending cancellation allows registration after restart", cancelPending),
      ("delayed OS cancellation is not adopted again", delayedCancellation),
      ("same ID re-registration clears cancellation marker", replaceCancelledPending),
      ("failed replacement does not consume the notification", failedReplacement),
      ("cancellation cannot clear an already handled ID", keepHandledOnCancellation),
      ("empty sync cancels pending but preserves consumed IDs", cancelAllPending),
      ("route stop and date each distinguish notification IDs", independentIdentifiers),
      ("repeating pending requests are not adopted", ignoreRepeatingPending),
      ("getStatus waits for a suspended sync registration", statusWaitsForSync),
      ("overlapping operations stay serialized across awaits", concurrentOperations),
      ("a failed operation releases the serialization gate", failedOperationReleasesGate),
    ]

    for (name, test) in tests {
      try await test()
      print("PASS: \(name)")
    }

    print("\(tests.count) Swift arrival notification tests passed")
  }

  private static func dismissedArrival() throws {
    var ledger = RouteArrivalNotificationLedger()
    ledger.recordSuccessfulRegistration(notificationId)
    ledger.reconcile(pendingIdentifiers: [notificationId], deliveredIdentifiers: [])
    ledger = try reload(ledger)

    // At 12:30, the 08:30 one-shot is no longer pending or in Notification Center.
    ledger.reconcile(pendingIdentifiers: [], deliveredIdentifiers: [])
    ledger = try reload(ledger)
    ledger.reconcile(pendingIdentifiers: [], deliveredIdentifiers: [])

    try expect(ledger.handledIdentifiers == [notificationId], "Dismissal lost handled ID")
    try expect(!ledger.canRegister(notificationId), "App restart would re-arm the same ID")
  }

  private static func immediatelyConsumed() throws {
    var ledger = RouteArrivalNotificationLedger()
    ledger.recordSuccessfulRegistration(notificationId)
    ledger.reconcile(pendingIdentifiers: [], deliveredIdentifiers: [])

    try expect(!ledger.canRegister(notificationId), "An accepted request was made retryable")
    try expect(ledger.scheduledIdentifiers.isEmpty, "Consumed request remains scheduled")
  }

  private static func adoptPending() throws {
    var ledger = RouteArrivalNotificationLedger()
    ledger.reconcile(pendingIdentifiers: [notificationId], deliveredIdentifiers: [])
    try expect(ledger.scheduledIdentifiers == [notificationId], "Legacy pending was not adopted")

    ledger = try reload(ledger)
    ledger.reconcile(pendingIdentifiers: [], deliveredIdentifiers: [])
    try expect(!ledger.canRegister(notificationId), "Migrated pending was re-armed after delivery")
  }

  private static func adoptDelivered() throws {
    var ledger = RouteArrivalNotificationLedger()
    ledger.reconcile(pendingIdentifiers: [], deliveredIdentifiers: [notificationId])
    ledger = try reload(ledger)
    ledger.reconcile(pendingIdentifiers: [], deliveredIdentifiers: [])

    try expect(ledger.handledIdentifiers == [notificationId], "Delivered ID was lost after dismissal")
  }

  private static func cancelPending() throws {
    var ledger = RouteArrivalNotificationLedger()
    ledger.recordSuccessfulRegistration(notificationId)
    ledger.recordCancellation([notificationId], pendingIdentifiers: [notificationId])
    ledger = try reload(ledger)
    ledger.reconcile(pendingIdentifiers: [], deliveredIdentifiers: [])

    try expect(ledger.canRegister(notificationId), "Explicit cancellation became a delivery")
    try expect(ledger.scheduledIdentifiers.isEmpty, "Cancelled ID still has a reservation")
    try expect(ledger.cancelledIdentifiers.isEmpty, "Confirmed removal left a stale marker")
  }

  private static func delayedCancellation() throws {
    var ledger = RouteArrivalNotificationLedger()
    ledger.recordSuccessfulRegistration(notificationId)
    ledger.recordCancellation([notificationId], pendingIdentifiers: [notificationId])
    ledger = try reload(ledger)
    ledger.reconcile(pendingIdentifiers: [notificationId], deliveredIdentifiers: [])

    try expect(ledger.scheduledIdentifiers.isEmpty, "Old OS pending was adopted after cancellation")
    try expect(!ledger.canPreservePending(notificationId), "Cancelled OS pending was preserved")
    ledger.reconcile(pendingIdentifiers: [], deliveredIdentifiers: [])
    try expect(ledger.canRegister(notificationId), "Delayed removal was mistaken for consumption")
  }

  private static func replaceCancelledPending() throws {
    var ledger = RouteArrivalNotificationLedger()
    ledger.recordSuccessfulRegistration(notificationId)
    ledger.recordCancellation([notificationId], pendingIdentifiers: [notificationId])
    ledger = try reload(ledger)
    ledger.reconcile(pendingIdentifiers: [notificationId], deliveredIdentifiers: [])

    // The old request is still visible, but sync must add the newly selected target.
    try expect(!ledger.canPreservePending(notificationId), "Replacement took the preserve branch")
    ledger.recordSuccessfulRegistration(notificationId)
    ledger = try reload(ledger)
    ledger.reconcile(pendingIdentifiers: [notificationId], deliveredIdentifiers: [])
    try expect(ledger.canPreservePending(notificationId), "New registration kept its tombstone")
    try expect(ledger.scheduledIdentifiers == [notificationId], "Replacement is no longer tracked")

    ledger.reconcile(pendingIdentifiers: [], deliveredIdentifiers: [])
    try expect(!ledger.canRegister(notificationId), "Replacement could repeat after delivery")
  }

  private static func failedReplacement() throws {
    var ledger = RouteArrivalNotificationLedger()
    ledger.recordSuccessfulRegistration(notificationId)
    ledger.recordCancellation([notificationId], pendingIdentifiers: [notificationId])
    do {
      try rejectRegistration()
      ledger.recordSuccessfulRegistration(notificationId)
    } catch TestFailure.registrationRejected {
      // A rejected add must leave no successful registration record.
    }
    ledger = try reload(ledger)
    ledger.reconcile(pendingIdentifiers: [], deliveredIdentifiers: [])

    try expect(ledger.handledIdentifiers.isEmpty, "Failed add was recorded as handled")
    try expect(ledger.canRegister(notificationId), "Failed add cannot be retried")
  }

  private static func keepHandledOnCancellation() throws {
    var ledger = RouteArrivalNotificationLedger()
    ledger.recordSuccessfulRegistration(notificationId)
    ledger.reconcile(pendingIdentifiers: [], deliveredIdentifiers: [])
    ledger.recordCancellation([notificationId], pendingIdentifiers: [])
    ledger.recordCancellation([notificationId], pendingIdentifiers: [notificationId])
    ledger.recordSuccessfulRegistration(notificationId)
    ledger = try reload(ledger)

    try expect(!ledger.canRegister(notificationId), "Cancellation erased a handled marker")
    try expect(ledger.scheduledIdentifiers.isEmpty, "Handled ID was registered again")
  }

  private static func cancelAllPending() throws {
    let consumedId = "arrival:route-b:stop-b:2026-08-28"
    var ledger = RouteArrivalNotificationLedger()
    ledger.recordSuccessfulRegistration(notificationId)
    ledger.recordSuccessfulRegistration(consumedId)
    ledger.reconcile(pendingIdentifiers: [notificationId], deliveredIdentifiers: [])
    ledger.recordCancellation([notificationId, consumedId], pendingIdentifiers: [notificationId])
    ledger.reconcile(pendingIdentifiers: [], deliveredIdentifiers: [])

    try expect(ledger.canRegister(notificationId), "Pending ID cannot be selected after logout")
    try expect(!ledger.canRegister(consumedId), "Clearing targets erased already consumed ID")
  }

  private static func independentIdentifiers() throws {
    let otherIdentifiers: Set<String> = [
      "arrival:route-b:stop-a:2026-08-28",
      "arrival:route-a:stop-b:2026-08-28",
      "arrival:route-a:stop-a:2026-08-29",
    ]
    var ledger = RouteArrivalNotificationLedger()
    ledger.reconcile(pendingIdentifiers: [], deliveredIdentifiers: [notificationId])

    try expect(otherIdentifiers.allSatisfy(ledger.canRegister), "Handled ID blocked another stop or date")
  }

  private static func ignoreRepeatingPending() throws {
    let repeatingId = "arrival:route-b:stop-b:2026-08-28"
    var ledger = RouteArrivalNotificationLedger()
    ledger.reconcile(
      pendingIdentifiers: [notificationId, repeatingId],
      deliveredIdentifiers: [],
      adoptablePendingIdentifiers: [notificationId]
    )
    ledger.reconcile(pendingIdentifiers: [], deliveredIdentifiers: [])

    try expect(!ledger.canRegister(notificationId), "One-shot pending was not adopted")
    try expect(ledger.canRegister(repeatingId), "Repeating pending was treated as a one-shot")
  }

  private static func statusWaitsForSync() async throws {
    let gate = RouteArrivalNotificationOperationGate()
    let addStarted = TestLatch()
    let finishAdd = TestLatch()
    let statusAttempted = TestLatch()
    let state = RegistrationState()

    let sync = Task {
      await gate.withLock {
        await addStarted.open()
        await finishAdd.wait()
        await state.acceptRegistration()
      }
    }
    await addStarted.wait()
    let status = Task {
      await statusAttempted.open()
      return await gate.withLock { await state.readStatus() }
    }
    await statusAttempted.wait()
    for _ in 0..<100 {
      await Task.yield()
    }

    let readsDuringAdd = await state.statusReads
    await finishAdd.open()
    await sync.value
    let ledger = await status.value

    try expect(readsDuringAdd == 0, "getStatus entered while sync was awaiting add")
    try expect(ledger.scheduledIdentifiers == [notificationId], "Status missed the completed add")
    try expect(ledger.handledIdentifiers.isEmpty, "Status prematurely consumed an in-flight add")
  }

  private static func concurrentOperations() async throws {
    let gate = RouteArrivalNotificationOperationGate()
    let probe = OperationProbe()
    await withTaskGroup(of: Void.self) { group in
      for _ in 0..<100 {
        group.addTask {
          await gate.withLock {
            await probe.enter()
            for _ in 0..<5 {
              await Task.yield()
            }
            await probe.leave()
          }
        }
      }
    }

    let maximumActive = await probe.maximumActiveCount
    let completed = await probe.completedCount
    try expect(maximumActive == 1, "Operations interleaved at an await")
    try expect(completed == 100, "The gate did not resume every waiting operation")
  }

  private static func failedOperationReleasesGate() async throws {
    let gate = RouteArrivalNotificationOperationGate()
    do {
      try await gate.withLock { try rejectRegistration() }
    } catch TestFailure.registrationRejected {
      // The next status/sync must still be able to enter.
    }

    let nextResult = await gate.withLock { 1 }
    try expect(nextResult == 1, "Thrown registration kept the gate locked")
  }

  private static func rejectRegistration() throws {
    throw TestFailure.registrationRejected
  }
}
