import Foundation
import Vision
import CoreGraphics

public struct GeneratedTypeAssessment:Codable,Sendable {
    public var lines:[RecognizedLine]
    public var recoveredTitleFraction:Double
    public var displayArea:Double
    public var displayLetterHeight:Double
    public var smallestInformationHeight:Double
    public var maskURL:URL?
    public var note="OCR runs on rendered generated type only. Photograph lettering and shapes cannot earn typography credit. Emphasis on articles, crops, repetitions and pale colors is not rejected."
}
public enum GeneratedTypographyJudge {
    public static func typeScene(_ scene:StyleGenome)->StyleGenome {
        var mask=scene;mask.background="#ffffff";mask.imageInfluence=nil
        mask.elements=scene.elements.filter{$0.kind=="text"}.map{e in var e=e;e.color="#000000";e.blendMode=nil;return e}
        return mask
    }
    public static func evaluate(_ scene:StyleGenome,maskURL:URL?=nil)throws->GeneratedTypeAssessment {
        let mask=try LibrarySceneRenderer.render(typeScene(scene),width:760)
        if let maskURL{try PosterRenderer.png(mask,to:maskURL)}
        let request=VNRecognizeTextRequest();request.recognitionLevel = .accurate;request.usesLanguageCorrection=false;request.minimumTextHeight=0.008
        try VNImageRequestHandler(cgImage:mask).perform([request])
        let lines=(request.results ?? []).compactMap{observation->RecognizedLine? in
            guard let text=observation.topCandidates(1).first else{return nil}
            let b=observation.boundingBox
            return .init(text:text.string,confidence:Double(text.confidence),bounds:.init(x:b.minX,y:1-b.maxY,width:b.width,height:b.height))
        }
        let recovered=lines.map(\.text).joined().uppercased().filter{$0.isLetter || $0.isNumber}
        let wanted=Array(Set((scene.posterCopy?.words ?? []).map{$0.uppercased().filter{$0.isLetter || $0.isNumber}})).filter{!$0.isEmpty}
        let fraction=Double(wanted.filter{recovered.contains($0)}.count)/Double(max(1,wanted.count))
        let display=scene.elements.filter{$0.kind=="text" && !$0.sourceElementID.hasPrefix("meta:")}
        let bounds=display.map{e->UnitBox in var e=e;e.rotation=0;return CompositionJudges.inkBounds(e,genome:scene)}
        let body=scene.elements.filter{$0.kind=="text" && $0.sourceElementID.hasPrefix("meta:")}.map{CompositionJudges.inkBounds($0,genome:scene).height}
        return .init(lines:lines,recoveredTitleFraction:fraction,displayArea:bounds.reduce(0){$0+$1.area},displayLetterHeight:bounds.map(\.height).max() ?? 0,smallestInformationHeight:body.min() ?? 0,maskURL:maskURL)
    }
    public static func measurements(_ original:Measurements,assessment:GeneratedTypeAssessment)->Measurements {
        var m=original;m.recognizedLines=assessment.lines;m.recognizedText=assessment.lines.map(\.text).joined(separator:" ")
        m.recognizedWords=assessment.lines.reduce(0){$0+$1.text.split(whereSeparator:{$0.isWhitespace}).count}
        m.readability=assessment.recoveredTitleFraction
        return m
    }
}
