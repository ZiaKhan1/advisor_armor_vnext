import CoreWLAN
import Foundation

func securityString(_ security: CWSecurity) -> String {
    switch security {
    case .none: return "Open"
    case .WEP: return "WEP"
    case .wpaPersonal: return "WPA Personal"
    case .wpaPersonalMixed: return "WPA/WPA2 Personal Mixed"
    case .wpa2Personal: return "WPA2 Personal"
    case .personal: return "Personal"
    case .dynamicWEP: return "Dynamic WEP"
    case .wpaEnterprise: return "WPA Enterprise"
    case .wpaEnterpriseMixed: return "WPA/WPA2 Enterprise Mixed"
    case .wpa2Enterprise: return "WPA2 Enterprise"
    case .enterprise: return "Enterprise"
    case .wpa3Personal: return "WPA3 Personal"
    case .wpa3Enterprise: return "WPA3 Enterprise"
    case .wpa3Transition: return "WPA3/WPA2 Personal Transition"
    case .OWE: return "Enhanced Open"
    case .oweTransition: return "Enhanced Open Transition"
    case .unknown: return "Unknown"
    @unknown default: return "Unknown"
    }
}

func getWifiInfo() -> [String: Any] {
    let client = CWWiFiClient.shared()
    let interface = client.interface() ?? client.interfaces()?.first

    guard let interface = interface else {
        return ["error": "No Wi-Fi interface found"]
    }

    let security = interface.security()
    var result: [String: Any] = [
        "security": securityString(security),
        "securityRawValue": security.rawValue
    ]

    if let ssid = interface.ssid() {
        result["ssid"] = ssid
    }

    return result
}

func main() {
    let info = getWifiInfo()
    if let json = try? JSONSerialization.data(withJSONObject: info),
       let output = String(data: json, encoding: .utf8) {
        print(output)
    } else {
        print("{\"error\":\"Failed to encode JSON\"}")
    }
}

main()
