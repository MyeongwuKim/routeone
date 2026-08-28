import Foundation

struct RouteArrivalNotificationLedger: Codable, Equatable, Sendable {
  private(set) var scheduledIdentifiers: Set<String> = []
  private(set) var handledIdentifiers: Set<String> = []
  private(set) var cancelledIdentifiers: Set<String> = []

  mutating func reconcile(
    pendingIdentifiers: Set<String>,
    deliveredIdentifiers: Set<String>,
    adoptablePendingIdentifiers: Set<String>? = nil
  ) {
    handledIdentifiers.formUnion(deliveredIdentifiers)
    // A one-shot missing without explicit cancellation must not be re-armed.
    // This marker is not proof of delivery and does not provide its timestamp.
    handledIdentifiers.formUnion(scheduledIdentifiers.subtracting(pendingIdentifiers))
    scheduledIdentifiers.formUnion(
      (adoptablePendingIdentifiers ?? pendingIdentifiers)
        .intersection(pendingIdentifiers)
        .subtracting(handledIdentifiers)
        .subtracting(cancelledIdentifiers)
    )
    scheduledIdentifiers.subtract(handledIdentifiers)
    cancelledIdentifiers.formIntersection(pendingIdentifiers)
  }

  func canPreservePending(_ identifier: String) -> Bool {
    !handledIdentifiers.contains(identifier) && !cancelledIdentifiers.contains(identifier)
  }

  func canRegister(_ identifier: String) -> Bool {
    !handledIdentifiers.contains(identifier)
  }

  mutating func recordSuccessfulRegistration(_ identifier: String) {
    guard canRegister(identifier) else {
      return
    }

    cancelledIdentifiers.remove(identifier)
    scheduledIdentifiers.insert(identifier)
  }

  mutating func recordCancellation(
    _ identifiers: Set<String>,
    pendingIdentifiers: Set<String>
  ) {
    let cancelledPending = identifiers.intersection(pendingIdentifiers)
    scheduledIdentifiers.subtract(cancelledPending)
    cancelledIdentifiers.formUnion(cancelledPending.subtracting(handledIdentifiers))
  }
}

actor RouteArrivalNotificationOperationGate {
  private var isRunning = false
  private var waiters: [CheckedContinuation<Void, Never>] = []

  private func acquire() async {
    if !isRunning {
      isRunning = true
      return
    }

    await withCheckedContinuation { continuation in
      waiters.append(continuation)
    }
  }

  private func release() {
    if waiters.isEmpty {
      isRunning = false
    } else {
      waiters.removeFirst().resume()
    }
  }

  nonisolated func withLock<T>(
    _ operation: () async throws -> T
  ) async rethrows -> T {
    // Actor isolation alone would allow the next operation in at an await.
    await acquire()

    do {
      let result = try await operation()
      await release()
      return result
    } catch {
      await release()
      throw error
    }
  }
}
