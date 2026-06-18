import PerlinNoise, { meta as perlinNoise } from "./algorithms/PerlinNoise.js";
import RandomWalk, { meta as randomWalk } from "./algorithms/RandomWalk.js";
import FlowField, { meta as flowField } from "./algorithms/FlowField.js";
import ParticleAttractor, { meta as particleAttractor } from "./algorithms/ParticleAttractor.js";
import BoidsFlocking, { meta as boidsFlocking } from "./algorithms/BoidsFlocking.js";
import GameOfLife, { meta as gameOfLife } from "./algorithms/GameOfLife.js";
import ReactionDiffusion, { meta as reactionDiffusion } from "./algorithms/ReactionDiffusion.js";
import LSystemTree, { meta as lSystemTree } from "./algorithms/LSystemTree.js";
import Voronoi, { meta as voronoi } from "./algorithms/Voronoi.js";
import CirclePacking, { meta as circlePacking } from "./algorithms/CirclePacking.js";
import SpringGrid, { meta as springGrid } from "./algorithms/SpringGrid.js";
import LorenzAttractor, { meta as lorenzAttractor } from "./algorithms/LorenzAttractor.js";
import SimplexNoise, { meta as simplexNoise } from "./algorithms/SimplexNoise.js";
import WorleyNoise, { meta as worleyNoise } from "./algorithms/WorleyNoise.js";
import DomainWarping, { meta as domainWarping } from "./algorithms/DomainWarping.js";
import CurlNoise, { meta as curlNoise } from "./algorithms/CurlNoise.js";
import DLAGrowth, { meta as dlaGrowth } from "./algorithms/DLAGrowth.js";
import SlimeMold, { meta as slimeMold } from "./algorithms/SlimeMold.js";
import PoissonDisk, { meta as poissonDisk } from "./algorithms/PoissonDisk.js";
import DelaunayTriangulation, { meta as delaunay } from "./algorithms/DelaunayTriangulation.js";
import JuliaSet, { meta as juliaSet } from "./algorithms/JuliaSet.js";
import MandelbrotSet, { meta as mandelbrotSet } from "./algorithms/MandelbrotSet.js";
import VerletCloth, { meta as verletCloth } from "./algorithms/VerletCloth.js";
import PixelSorting, { meta as pixelSorting } from "./algorithms/PixelSorting.js";
import MarchingSquaresMetaballs, { meta as marchingSquaresMetaballs } from "./algorithms/MarchingSquaresMetaballs.js";
import WaveFunctionCollapse, { meta as waveFunctionCollapse } from "./algorithms/WaveFunctionCollapse.js";
import MazeBacktracker, { meta as mazeBacktracker } from "./algorithms/MazeBacktracker.js";
import HilbertCurve, { meta as hilbertCurve } from "./algorithms/HilbertCurve.js";
import FourierEpicycles, { meta as fourierEpicycles } from "./algorithms/FourierEpicycles.js";
import Spirograph, { meta as spirograph } from "./algorithms/Spirograph.js";
import ChladniPattern, { meta as chladniPattern } from "./algorithms/ChladniPattern.js";
import MoirePattern, { meta as moirePattern } from "./algorithms/MoirePattern.js";
import ElementaryCellularAutomata, { meta as elementaryCellularAutomata } from "./algorithms/ElementaryCellularAutomata.js";
import AbelianSandpile, { meta as abelianSandpile } from "./algorithms/AbelianSandpile.js";
import ForestFire, { meta as forestFire } from "./algorithms/ForestFire.js";
import FabrikIK, { meta as fabrikIK } from "./algorithms/FabrikIK.js";
import SpaceColonizationTree, { meta as spaceColonizationTree } from "./algorithms/SpaceColonizationTree.js";
import AntColonyTrails, { meta as antColonyTrails } from "./algorithms/AntColonyTrails.js";
import PredatorPrey, { meta as predatorPrey } from "./algorithms/PredatorPrey.js";
import SteeringBehaviors, { meta as steeringBehaviors } from "./algorithms/SteeringBehaviors.js";
import NBodyGravity, { meta as nBodyGravity } from "./algorithms/NBodyGravity.js";
import DoublePendulum, { meta as doublePendulum } from "./algorithms/DoublePendulum.js";
import RippleSimulation, { meta as rippleSimulation } from "./algorithms/RippleSimulation.js";
import GerstnerWaves, { meta as gerstnerWaves } from "./algorithms/GerstnerWaves.js";
import TruchetTiles, { meta as truchetTiles } from "./algorithms/TruchetTiles.js";
import FloydSteinbergDithering, { meta as floydSteinbergDithering } from "./algorithms/FloydSteinbergDithering.js";
import Halftone, { meta as halftone } from "./algorithms/Halftone.js";
import SDFMorphing, { meta as sdfMorphing } from "./algorithms/SDFMorphing.js";

export const algorithmEntries = [
  [perlinNoise, PerlinNoise],
  [randomWalk, RandomWalk],
  [flowField, FlowField],
  [particleAttractor, ParticleAttractor],
  [boidsFlocking, BoidsFlocking],
  [gameOfLife, GameOfLife],
  [reactionDiffusion, ReactionDiffusion],
  [lSystemTree, LSystemTree],
  [voronoi, Voronoi],
  [circlePacking, CirclePacking],
  [springGrid, SpringGrid],
  [lorenzAttractor, LorenzAttractor],
  [simplexNoise, SimplexNoise],
  [worleyNoise, WorleyNoise],
  [domainWarping, DomainWarping],
  [curlNoise, CurlNoise],
  [dlaGrowth, DLAGrowth],
  [slimeMold, SlimeMold],
  [poissonDisk, PoissonDisk],
  [delaunay, DelaunayTriangulation],
  [juliaSet, JuliaSet],
  [mandelbrotSet, MandelbrotSet],
  [verletCloth, VerletCloth],
  [pixelSorting, PixelSorting],
  [marchingSquaresMetaballs, MarchingSquaresMetaballs],
  [waveFunctionCollapse, WaveFunctionCollapse],
  [mazeBacktracker, MazeBacktracker],
  [hilbertCurve, HilbertCurve],
  [fourierEpicycles, FourierEpicycles],
  [spirograph, Spirograph],
  [chladniPattern, ChladniPattern],
  [moirePattern, MoirePattern],
  [elementaryCellularAutomata, ElementaryCellularAutomata],
  [abelianSandpile, AbelianSandpile],
  [forestFire, ForestFire],
  [fabrikIK, FabrikIK],
  [spaceColonizationTree, SpaceColonizationTree],
  [antColonyTrails, AntColonyTrails],
  [predatorPrey, PredatorPrey],
  [steeringBehaviors, SteeringBehaviors],
  [nBodyGravity, NBodyGravity],
  [doublePendulum, DoublePendulum],
  [rippleSimulation, RippleSimulation],
  [gerstnerWaves, GerstnerWaves],
  [truchetTiles, TruchetTiles],
  [floydSteinbergDithering, FloydSteinbergDithering],
  [halftone, Halftone],
  [sdfMorphing, SDFMorphing],
];

export const algorithmRegistry = new Map(
  algorithmEntries.map(([meta, Algorithm]) => [meta.id, { meta, Algorithm }]),
);

export function createAlgorithm(id, canvas, params = {}) {
  const entry = algorithmRegistry.get(id);
  if (!entry) throw new Error(`Unknown algorithm: ${id}`);
  return new entry.Algorithm(canvas, params);
}

export function listAlgorithms() {
  return algorithmEntries.map(([meta, Algorithm]) => ({
    ...meta,
    defaultParams: { ...Algorithm.defaults },
  }));
}

export function getAlgorithmDefaults(id) {
  const entry = algorithmRegistry.get(id);
  if (!entry) throw new Error(`Unknown algorithm: ${id}`);
  return { ...entry.Algorithm.defaults };
}
