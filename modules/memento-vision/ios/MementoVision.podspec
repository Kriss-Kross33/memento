require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'MementoVision'
  s.version        = package['version']
  s.summary        = 'On-device Apple Vision text recognition for Memento'
  s.description    = 'Local Vision OCR. Receipt images never leave the device.'
  s.author         = 'Memento'
  s.homepage       = 'https://github.com/expo/expo'
  s.license        = 'MIT'
  s.platforms      = { ios: '16.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.source_files = '*.{h,m,mm,swift}'

  s.swift_version = '5.9'
end
