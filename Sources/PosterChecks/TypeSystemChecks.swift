import Foundation
import PosterCore

extension PosterChecks {
    static func checkTypeSystems()throws {
        let bank=TypeSystemLibrary.shared
        guard let migration=bank.systems.first(where:{$0.operation=="grapheme-migration"}),let erosion=bank.systems.first(where:{$0.operation=="compensated-erosion"}),let heart=bank.systems.first(where:{$0.operation=="tittle-substitution"}) else{throw CheckFailure("Missing observed type-system fixtures")}
        let expected=["positions","opsitions","ospitions","osiptions","ositpions","ositipons","ositiopns","ositionps","ositionsp"]
        let steps=try TypeSystemEngine.steps(migration,input:"positions")
        try require(steps.map(\.text)==expected,"Observed moving-p sequence was not recovered")
        let eroded=try TypeSystemEngine.steps(erosion,input:"autourdumonde")
        try require(eroded.map(\.text)==["autourdumonde","utourdudmonde","tourdudumonde","ourdududmonde","urdududumonde","rdudududmonde"],"Periodic d/u compensation does not match the six observed rows")
        let unicode="a👩🏽‍🎨e\u{301}Z"
        let unicodeSteps=try TypeSystemEngine.steps(migration,input:unicode,overrides:["movingIndex":1,"direction":1])
        for step in unicodeSteps {try require(step.text.count==unicode.count && Set(step.indexMap)==Set(0..<unicode.count),"Migration split a Unicode grapheme or lost its index")}
        let reversed=try TypeSystemEngine.steps(migration,input:"horizons",overrides:["movingIndex":7,"direction":-1,"maxRows":4])
        try require(reversed.count==4 && reversed[0].text=="horizons" && reversed[1].text=="horizosn","Leftward moving index or maximum steps ignored")
        let original=try TypeSystemEngine.scene(migration,input:"horizons"),edited=try TypeSystemEngine.scene(migration,input:"horizons",overrides:["pitch":0.8,"tracking":4,"fontScale":1.1,"angle":8])
        try require(Set(original.elements.compactMap(\.typeEmSize)).count==1,"Migrating rows change font size")
        let originalPixels=try rgba(LibrarySceneRenderer.render(original,width:360)),editedPixels=try rgba(LibrarySceneRenderer.render(edited,width:360))
        try require(originalPixels != editedPixels,"Interactive controls do not affect rendering")
        let scene=try TypeSystemEngine.scene(heart,input:"Infinite")
        var plain=scene;for i in plain.elements.indices{plain.elements[i].glyphTreatment=nil}
        let heartPixels=try rgba(LibrarySceneRenderer.render(scene,width:700)),plainPixels=try rgba(LibrarySceneRenderer.render(plain,width:700))
        try require(heartPixels != plainPixels,"Heart tittle did not change the selected glyph outline")
        let variant=TypeSystemVariant(system:migration,input:"horizons",overrides:["pitch":0.8,"tracking":4,"fontScale":1.1,"angle":8],fontProfileID:nil,foreground:"#191c22",accent:"#3d52b6",background:"#f0eee7",scene:edited)
        let restored=try JSONDecoder().decode(TypeSystemVariant.self,from:JSONEncoder().encode(variant))
        let replayPixels=try rgba(LibrarySceneRenderer.render(restored.replay(),width:360))
        try require(replayPixels == editedPixels,"Saved variation does not reproduce pixels")
        if let rotation=bank.systems.first(where:{$0.id=="09179c3c09e20b8aa637821f-p0-rotation-field-6b81104951d6"}) {
            let lanes=try TypeSystemEngine.scene(rotation,input:"OPEN FORMS")
            let boxes=lanes.elements.map{CompositionJudges.inkBounds($0,genome:lanes)}.sorted{$0.x<$1.x}
            for i in 1..<boxes.count{try require(boxes[i].x>=boxes[i-1].x+boxes[i-1].width-0.001,"Regularized rotation lanes overlap")}
            try require(lanes.elements.allSatisfy{abs($0.rotation.truncatingRemainder(dividingBy:90))<0.001},"OCR rotation jitter survived baseline snapping")
            if let opposed=bank.systems.first(where:{$0.operation=="rotation-field" && $0.parameters["opposed"]==1}) {
                let allowed=opposed.frames.map{frame in let snapped=(frame.rotation/90).rounded()*90;return abs(snapped-frame.rotation)<14 ? snapped:frame.rotation}
                for count in [3.0,8.0,13.0]{let rows=try TypeSystemEngine.steps(opposed,input:"OPEN FORMS",overrides:["count":count]);try require(rows.allSatisfy{row in allowed.contains{abs($0-row.rotation)<0.001}},"Changing lane count invented interpolated directions between source baselines")}
            }
        }
        for system in bank.systems {
            try require(system.semanticEmbedding.count==bank.catalog?.featureNames.count && system.semanticEmbedding.allSatisfy(\.isFinite),"Invalid method embedding")
            try require(system.sourceEmbedding?.dimensions==768,"Missing native source-element embedding")
        }
        print("PASS: observed letter sequences, Unicode graphemes, reverse/step controls, constant em, heart glyph pixels, saved variation replay and all type-system embeddings")
    }
}
