Pod::Spec.new do |s|
  s.name = 'CapacitorFolderAccess'
  s.version = '1.0.0'
  s.summary = 'Bestående åtkomst till en vald mapp i appen Filer'
  s.license = { :type => 'Proprietary' }
  s.homepage = 'https://github.com/patrikgune-beep/appdevrepo'
  s.author = 'Fakturaanalys'
  s.source = { :git => 'https://github.com/patrikgune-beep/appdevrepo.git', :tag => s.version.to_s }
  s.source_files = 'ios/Sources/**/*.swift'
  s.ios.deployment_target = '15.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.9'
end
