import Foundation

public struct TypeSystemCuration:Codable,Sendable {
    public struct Group:Codable,Sendable {public let canonicalID:String;public let memberIDs:[String];public let basis:String}
    public let version:String
    public let modelFingerprint:String
    public let sourceSystems:Int
    public let distinctSystems:Int
    public let aliases:[String:String]
    public let groups:[Group]
    public let exactProbeDuplicates:Int
    public let reviewer:String
    public let note:String
}
