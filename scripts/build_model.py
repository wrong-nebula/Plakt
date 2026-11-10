"""Build an authored composition prior, not a pretrained aesthetic judge.

Eight measured/desirability features -> ReLU -> weighted sigmoid. The weights
are explicit design choices. Human selections guide the separate evolution loop.
Requires only the build-time dependency coremltools==8.3.0 (Python 3.11).
"""
from pathlib import Path
import numpy as np
import coremltools as ct
from coremltools.models import datatypes
from coremltools.models.neural_network import NeuralNetworkBuilder

builder = NeuralNetworkBuilder([('features', datatypes.Array(8))], [('quality', datatypes.Array(1))])
builder.add_inner_product(name='feature_projection', W=np.eye(8, dtype=np.float32), b=np.zeros(8, dtype=np.float32),
                         input_channels=8, output_channels=8, has_bias=True, input_name='features', output_name='hidden')
builder.add_activation(name='relu', non_linearity='RELU', input_name='hidden', output_name='positive')
builder.add_inner_product(name='composition_prior', W=np.array([[1.4, 1.1, 1.0, 0.7, 0.4, 1.2, 0.7, 0.5]], dtype=np.float32),
                         b=np.array([-3.6], dtype=np.float32), input_channels=8, output_channels=1,
                         has_bias=True, input_name='positive', output_name='logit')
builder.add_activation(name='quality', non_linearity='SIGMOID', input_name='logit', output_name='quality')
spec = builder.spec
spec.description.metadata.shortDescription = 'Authored typographic composition prior; heuristic weights, no aesthetic training corpus.'
spec.description.metadata.author = 'PosterLab'
spec.description.input[0].shortDescription = 'coverage, detail, balance, contrast, OCR, reference, hierarchy, repetition desirability (0…1)'
spec.description.output[0].shortDescription = 'Composition prior in 0…1; a heuristic, not an objective taste score.'
path = Path(__file__).resolve().parents[1] / 'Sources/PosterCore/Resources/CompositionPrior.mlmodel'
ct.utils.save_spec(spec, str(path))
print(path)
