import Foundation

extension PosterShapeLibrary {
    /// Separate from active discovery outputs to preserve parallel research.
    public static let surveyRecipes: [PosterShapeRecipe] = {
        guard let url = PosterResources.bundle.url(forResource: "SurveyRecipes", withExtension: "json", subdirectory: "Resources/ShapeLibrary"),
              let data = try? Data(contentsOf: url),
              let recipes = try? JSONDecoder().decode([PosterShapeRecipe].self, from: data) else { return [] }
        return recipes
    }()
}
