Pod::Spec.new do |s|
  s.name             = 'RouteArrivalNotifications'
  s.version          = '1.0.0'
  s.summary          = 'Schedules RouteOne arrival notifications with iOS location triggers.'
  s.description      = 'Schedules system-managed local notifications when the device enters a destination region.'
  s.license          = { :type => 'MIT' }
  s.author           = 'RouteOne'
  s.homepage         = 'https://routeone.app'
  s.platforms        = { :ios => '16.4' }
  s.swift_version    = '5.9'
  s.source           = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,mm,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
