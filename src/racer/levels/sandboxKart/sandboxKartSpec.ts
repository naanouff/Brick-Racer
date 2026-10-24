/**
 * @file sandboxKartSpec.ts
 * @description Sandbox kart level data (ported from former SceneDD lego-kart.json).
 * Auto-extracted; edit carefully — this is the game-owned level contract.
 */

import type { SandboxKartLevel } from './types';

export const sandboxKartSpec: SandboxKartLevel = {
  "id": "sandbox-kart",
  "shaderGraphs": [
    {
      "id": "pbr",
      "url": "/shader-graphs/PBRGraph.json"
    },
    {
      "id": "lego_abs",
      "url": "/shader-graphs/RockProceduralPBR.json"
    }
  ],
  "geometryGraphs": [
    {
      "id": "lego_brick",
      "url": "/gproc/lego-brick-generator.json"
    },
    {
      "id": "lego_wheel",
      "url": "/gproc/lego-wheel-generator.json"
    },
    {
      "id": "lego_axle_bracket",
      "url": "/gproc/lego-axle-bracket-generator.json"
    },
    {
      "id": "lego_handle_bar",
      "url": "/gproc/lego-handle-bar-generator.json"
    }
  ],
  "scriptGraphs": [
    {
      "id": "kart_drive",
      "url": "/script-graphs/kart-drive.json"
    }
  ],
  "materials": {
    "LK_Asphalt": {
      "shaderGraphId": "pbr",
      "name": "LK_Asphalt",
      "properties": {
        "baseColor": [
          1,
          1,
          1
        ],
        "roughness": 0.92,
        "metallic": 0
      }
    },
    "LK_Ramp": {
      "shaderGraphId": "pbr",
      "name": "LK_Ramp",
      "properties": {
        "baseColor": [
          0.92,
          0.72,
          0.12
        ],
        "roughness": 0.4,
        "metallic": 0.05
      }
    },
    "LK_Abs": {
      "shaderGraphId": "lego_abs",
      "name": "LegoAbsPBRMaterial",
      "properties": {
        "rockColor": [
          0.82,
          0.14,
          0.14
        ],
        "mossColor": [
          0.22,
          0.1,
          0.07
        ],
        "wearColor": [
          0.92,
          0.55,
          0.48
        ],
        "mossAmount": 0.12,
        "edgeWear": 0.35,
        "aoStrength": 0.32,
        "heightInfluence": 0.06,
        "roughness": 0.34,
        "metallic": 0.04,
        "triplanarScale": 4.2,
        "normalDetailScale": 0.03,
        "macroAlbedo": 0,
        "greaseGloss": 0.58
      }
    },
    "LK_WheelRim": {
      "shaderGraphId": "lego_abs",
      "name": "LK_WheelRim",
      "properties": {
        "rockColor": [
          0.72,
          0.72,
          0.74
        ],
        "mossColor": [
          0.4,
          0.4,
          0.42
        ],
        "wearColor": [
          0.88,
          0.88,
          0.9
        ],
        "mossAmount": 0.1,
        "edgeWear": 0.3,
        "aoStrength": 0.5,
        "heightInfluence": 0.05,
        "roughness": 0.35,
        "metallic": 0.08,
        "triplanarScale": 6,
        "normalDetailScale": 0.025,
        "macroAlbedo": 0,
        "greaseGloss": 0.4
      }
    },
    "LK_WheelTire": {
      "shaderGraphId": "pbr",
      "name": "LK_WheelTire",
      "properties": {
        "baseColor": [
          0.06,
          0.055,
          0.05
        ],
        "roughness": 0.96,
        "metallic": 0,
        "specularFactor": 0.04,
        "specularColorFactor": [
          0.1,
          0.1,
          0.1
        ],
        "ior": 1.45
      }
    },
    "LK_Bracket": {
      "shaderGraphId": "lego_abs",
      "name": "LK_Black",
      "properties": {
        "rockColor": [
          0.06,
          0.06,
          0.07
        ],
        "mossColor": [
          0.02,
          0.02,
          0.025
        ],
        "wearColor": [
          0.18,
          0.18,
          0.2
        ],
        "mossAmount": 0.1,
        "edgeWear": 0.28,
        "aoStrength": 0.5,
        "heightInfluence": 0.05,
        "roughness": 0.34,
        "metallic": 0.04,
        "triplanarScale": 5,
        "normalDetailScale": 0.025,
        "macroAlbedo": 0,
        "greaseGloss": 0.5
      }
    },
    "LK_Black": {
      "shaderGraphId": "lego_abs",
      "name": "LK_Black",
      "properties": {
        "rockColor": [
          0.06,
          0.06,
          0.07
        ],
        "mossColor": [
          0.02,
          0.02,
          0.025
        ],
        "wearColor": [
          0.18,
          0.18,
          0.2
        ],
        "mossAmount": 0.1,
        "edgeWear": 0.28,
        "aoStrength": 0.5,
        "heightInfluence": 0.05,
        "roughness": 0.34,
        "metallic": 0.04,
        "triplanarScale": 5,
        "normalDetailScale": 0.025,
        "macroAlbedo": 0,
        "greaseGloss": 0.5
      }
    },
    "LK_Yellow": {
      "shaderGraphId": "lego_abs",
      "name": "LK_Yellow",
      "properties": {
        "rockColor": [
          0.95,
          0.82,
          0.12
        ],
        "mossColor": [
          0.55,
          0.4,
          0.05
        ],
        "wearColor": [
          1,
          0.92,
          0.45
        ],
        "mossAmount": 0.08,
        "edgeWear": 0.25,
        "aoStrength": 0.4,
        "heightInfluence": 0.04,
        "roughness": 0.3,
        "metallic": 0.04,
        "triplanarScale": 5.5,
        "normalDetailScale": 0.02,
        "macroAlbedo": 0,
        "greaseGloss": 0.55
      }
    },
    "LK_Glass": {
      "shaderGraphId": "pbr",
      "name": "LK_Glass",
      "properties": {
        "baseColor": [
          0.22,
          0.58,
          0.86,
          0.58
        ],
        "roughness": 0.05,
        "metallic": 0,
        "opacity": 0.48,
        "transmissionFactor": 0.62,
        "ior": 1.49,
        "thicknessFactor": 0.05,
        "attenuationDistance": 0.07,
        "attenuationColor": [
          0.38,
          0.68,
          0.95
        ],
        "dispersionFactor": 0.42,
        "alphaMode": "BLEND",
        "doubleSided": true,
        "tag": "transparent"
      }
    },
    "LK_Blue": {
      "shaderGraphId": "pbr",
      "name": "LK_Blue",
      "properties": {
        "baseColor": [
          0.12,
          0.35,
          0.72
        ],
        "roughness": 0.4,
        "metallic": 0.05
      }
    },
    "LK_Skin": {
      "shaderGraphId": "pbr",
      "name": "LK_Skin",
      "properties": {
        "baseColor": [
          0.95,
          0.78,
          0.22
        ],
        "roughness": 0.45,
        "metallic": 0
      }
    },
    "LK_Hair": {
      "shaderGraphId": "pbr",
      "name": "LK_Hair",
      "properties": {
        "baseColor": [
          0.75,
          0.12,
          0.1
        ],
        "roughness": 0.55,
        "metallic": 0
      }
    },
    "LK_Grey": {
      "shaderGraphId": "lego_abs",
      "name": "LK_Grey",
      "properties": {
        "rockColor": [
          0.72,
          0.72,
          0.74
        ],
        "mossColor": [
          0.4,
          0.4,
          0.42
        ],
        "wearColor": [
          0.88,
          0.88,
          0.9
        ],
        "mossAmount": 0.08,
        "edgeWear": 0.25,
        "aoStrength": 0.4,
        "heightInfluence": 0.04,
        "roughness": 0.32,
        "metallic": 0.05,
        "triplanarScale": 5.5,
        "normalDetailScale": 0.02,
        "macroAlbedo": 0,
        "greaseGloss": 0.5
      }
    }
  },
  "primitives": {
    "lk_cube": {
      "type": "cube",
      "params": {
        "size": 1
      }
    },
    "lk_ground": {
      "type": "cube",
      "params": {
        "size": 1,
        "worldUvScaleX": 48,
        "worldUvScaleY": 1,
        "worldUvScaleZ": 48
      }
    },
    "lk_cyl_thin": {
      "type": "cylinder",
      "params": {
        "radiusTop": 0.012,
        "radiusBottom": 0.012,
        "height": 0.16,
        "radialSegments": 12,
        "heightSegments": 1
      }
    },
    "lk_cyl_bar": {
      "type": "cylinder",
      "params": {
        "radiusTop": 0.012,
        "radiusBottom": 0.012,
        "height": 0.264,
        "radialSegments": 12,
        "heightSegments": 1
      }
    },
    "lk_head": {
      "type": "cylinder",
      "params": {
        "radiusTop": 0.018,
        "radiusBottom": 0.018,
        "height": 0.028,
        "radialSegments": 16,
        "heightSegments": 1
      }
    },
    "lk_steer": {
      "type": "cylinder",
      "params": {
        "radiusTop": 0.016,
        "radiusBottom": 0.016,
        "height": 0.004,
        "radialSegments": 16,
        "heightSegments": 1
      }
    }
  },
  "entities": [
    {
      "id": "LK_Sun",
      "name": "LK_Sun",
      "parentId": null,
      "transform": {
        "position": [
          -28,
          22,
          14
        ],
        "rotation": [
          0,
          0,
          0,
          1
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "directionalLight",
          "color": [
            1,
            0.97,
            0.92
          ],
          "intensity": 3.2,
          "castShadow": true,
          "direction": [
            0.35,
            -0.85,
            0.4
          ]
        }
      ]
    },
    {
      "id": "LK_Ground",
      "name": "LK_Ground",
      "parentId": null,
      "transform": {
        "position": [
          0,
          -0.5,
          0
        ],
        "rotation": [
          0,
          0,
          0,
          1
        ],
        "scale": [
          48,
          1,
          48
        ]
      },
      "components": [
        {
          "type": "renderable",
          "meshId": "lk_ground",
          "materialId": "LK_Asphalt",
          "castShadow": true
        },
        {
          "type": "rigidBody",
          "mass": 0,
          "useGravity": false,
          "isKinematic": true,
          "drag": 0,
          "angularDrag": 0,
          "restitution": 0,
          "friction": 1.15
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            24,
            0.5,
            24
          ],
          "collisionGroup": 4,
          "collisionMask": 4294967295
        }
      ]
    },
    {
      "id": "LK_Ramp_N",
      "name": "LK_Ramp_N",
      "parentId": null,
      "transform": {
        "position": [
          0,
          0.427,
          4.2
        ],
        "rotation": [
          -0.20791169081775931,
          0,
          0,
          0.9781476007338057
        ],
        "scale": [
          2.4,
          0.6,
          3.3
        ]
      },
      "components": [
        {
          "type": "renderable",
          "meshId": "lk_cube",
          "materialId": "LK_Ramp",
          "castShadow": true
        },
        {
          "type": "rigidBody",
          "mass": 0,
          "useGravity": false,
          "isKinematic": true,
          "drag": 0,
          "angularDrag": 0,
          "restitution": 0,
          "friction": 0.95
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            1.2,
            0.3,
            1.65
          ],
          "collisionGroup": 16
        }
      ]
    },
    {
      "id": "LK_Ramp_S",
      "name": "LK_Ramp_S",
      "parentId": null,
      "transform": {
        "position": [
          0,
          0.427,
          -4.2
        ],
        "rotation": [
          0.20791169081775931,
          0,
          0,
          0.9781476007338057
        ],
        "scale": [
          2.4,
          0.6,
          3.3
        ]
      },
      "components": [
        {
          "type": "renderable",
          "meshId": "lk_cube",
          "materialId": "LK_Ramp",
          "castShadow": true
        },
        {
          "type": "rigidBody",
          "mass": 0,
          "useGravity": false,
          "isKinematic": true,
          "drag": 0,
          "angularDrag": 0,
          "restitution": 0,
          "friction": 0.95
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            1.2,
            0.3,
            1.65
          ],
          "collisionGroup": 16
        }
      ]
    },
    {
      "id": "LK_Ramp_E",
      "name": "LK_Ramp_E",
      "parentId": null,
      "transform": {
        "position": [
          4,
          0.427,
          0
        ],
        "rotation": [
          0,
          0,
          0.20791169081775931,
          0.9781476007338057
        ],
        "scale": [
          3.3,
          0.6,
          2.4
        ]
      },
      "components": [
        {
          "type": "renderable",
          "meshId": "lk_cube",
          "materialId": "LK_Ramp",
          "castShadow": true
        },
        {
          "type": "rigidBody",
          "mass": 0,
          "useGravity": false,
          "isKinematic": true,
          "drag": 0,
          "angularDrag": 0,
          "restitution": 0,
          "friction": 0.95
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            1.65,
            0.3,
            1.2
          ],
          "collisionGroup": 16
        }
      ]
    },
    {
      "id": "KartChassis",
      "name": "KartChassis",
      "parentId": null,
      "transform": {
        "position": [
          0,
          0.22,
          0
        ],
        "rotation": [
          0,
          0,
          0,
          1
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "rigidBody",
          "mass": 1.5,
          "useGravity": true,
          "isKinematic": false,
          "drag": 0.02,
          "angularDrag": 0.2,
          "restitution": 0,
          "friction": 0.12
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            0.28,
            0.022,
            0.22
          ],
          "offset": [
            0,
            0.03,
            0.04
          ],
          "collisionGroup": 1,
          "collisionMask": 12
        },
        {
          "type": "vehicle",
          "rayMask": 20,
          "maxSteerAngle": 0.48,
          "steerSpeed": 5,
          "maxSpeed": 22,
          "driveTorque": 2.7,
          "brakeTorque": 0.85,
          "yawAssist": 3.4,
          "antiRollStiffness": 170,
          "rollDamping": 36,
          "pitchDamping": 18,
          "airAngularDamping": 14,
          "wheels": [
            {
              "id": "fl",
              "hardpoint": [
                -0.26,
                0,
                0.32
              ],
              "steered": true,
              "driven": true,
              "radius": 0.1,
              "restLength": 0.12,
              "travel": 0.1,
              "stiffness": 160,
              "damping": 52,
              "mu": 2.35,
              "longitudinalStiffness": 0.38,
              "corneringStiffness": 13
            },
            {
              "id": "fr",
              "hardpoint": [
                0.26,
                0,
                0.32
              ],
              "steered": true,
              "driven": true,
              "radius": 0.1,
              "restLength": 0.12,
              "travel": 0.1,
              "stiffness": 160,
              "damping": 52,
              "mu": 2.35,
              "longitudinalStiffness": 0.38,
              "corneringStiffness": 13
            },
            {
              "id": "rl",
              "hardpoint": [
                -0.26,
                0,
                -0.24
              ],
              "steered": false,
              "driven": false,
              "radius": 0.1,
              "restLength": 0.12,
              "travel": 0.1,
              "stiffness": 160,
              "damping": 52,
              "mu": 2.35,
              "longitudinalStiffness": 0.38,
              "corneringStiffness": 13
            },
            {
              "id": "rr",
              "hardpoint": [
                0.26,
                0,
                -0.24
              ],
              "steered": false,
              "driven": false,
              "radius": 0.1,
              "restLength": 0.12,
              "travel": 0.1,
              "stiffness": 160,
              "damping": 52,
              "mu": 2.35,
              "longitudinalStiffness": 0.38,
              "corneringStiffness": 13
            }
          ]
        },
        {
          "type": "scriptBinding",
          "scriptId": "kart_drive"
        }
      ]
    },
    {
      "id": "KartBasePlate",
      "name": "KartBasePlate",
      "parentId": "KartChassis",
      "transform": {
        "position": [
          0,
          -0.048,
          0
        ],
        "rotation": [
          0,
          0,
          0,
          1
        ],
        "scale": [
          0.1,
          0.1,
          0.1
        ]
      },
      "components": [
        {
          "type": "gproc",
          "graphId": "lego_brick",
          "materialIds": [
            "LK_Black"
          ],
          "parameters": {
            "WidthStuds": 4,
            "LengthStuds": 12,
            "HeightPlates": 1,
            "Kind": "plate"
          }
        }
      ]
    },
    {
      "id": "KartFrontGrey",
      "name": "KartFrontGrey",
      "parentId": "KartChassis",
      "transform": {
        "position": [
          0,
          -0.016,
          0.32
        ],
        "rotation": [
          0,
          0,
          0,
          1
        ],
        "scale": [
          0.1,
          0.1,
          0.1
        ]
      },
      "components": [
        {
          "type": "gproc",
          "graphId": "lego_brick",
          "materialIds": [
            "LK_Grey"
          ],
          "parameters": {
            "WidthStuds": 4,
            "LengthStuds": 4,
            "HeightPlates": 1,
            "Kind": "plate"
          }
        }
      ]
    },
    {
      "id": "KartHood",
      "name": "KartHood",
      "parentId": "KartChassis",
      "transform": {
        "position": [
          0,
          -0.016,
          0.08
        ],
        "rotation": [
          0,
          0,
          0,
          1
        ],
        "scale": [
          0.1,
          0.1,
          0.1
        ]
      },
      "components": [
        {
          "type": "gproc",
          "graphId": "lego_brick",
          "materialIds": [
            "LK_Abs"
          ],
          "parameters": {
            "WidthStuds": 4,
            "LengthStuds": 2,
            "HeightPlates": 1,
            "Kind": "plate"
          }
        }
      ]
    },
    {
      "id": "KartWindshield",
      "name": "KartWindshield",
      "parentId": "KartChassis",
      "transform": {
        "position": [
          0,
          0.016,
          0.08
        ],
        "rotation": [
          0,
          0,
          0,
          1
        ],
        "scale": [
          0.1,
          0.1,
          0.1
        ]
      },
      "components": [
        {
          "type": "gproc",
          "graphId": "lego_brick",
          "materialIds": [
            "LK_Glass"
          ],
          "parameters": {
            "WidthStuds": 4,
            "LengthStuds": 2,
            "HeightPlates": 8,
            "Kind": "slope",
            "SlopeAngle": 33,
            "Underside": false
          }
        }
      ]
    },
    {
      "id": "KartRearBrick",
      "name": "KartRearBrick",
      "parentId": "KartChassis",
      "transform": {
        "position": [
          0,
          -0.016,
          -0.24
        ],
        "rotation": [
          0,
          0,
          0,
          1
        ],
        "scale": [
          0.1,
          0.1,
          0.1
        ]
      },
      "components": [
        {
          "type": "gproc",
          "graphId": "lego_brick",
          "materialIds": [
            "LK_Abs"
          ],
          "parameters": {
            "WidthStuds": 4,
            "LengthStuds": 2,
            "HeightPlates": 3,
            "Kind": "brick"
          }
        }
      ]
    },
    {
      "id": "KartRearSlope",
      "name": "KartRearSlope",
      "parentId": "KartChassis",
      "transform": {
        "position": [
          0,
          -0.016,
          -0.4
        ],
        "rotation": [
          0,
          1,
          0,
          0
        ],
        "scale": [
          0.1,
          0.1,
          0.1
        ]
      },
      "components": [
        {
          "type": "gproc",
          "graphId": "lego_brick",
          "materialIds": [
            "LK_Abs"
          ],
          "parameters": {
            "WidthStuds": 4,
            "LengthStuds": 2,
            "HeightPlates": 3,
            "Kind": "slope",
            "SlopeAngle": 45
          }
        }
      ]
    },
    {
      "id": "KartNose",
      "name": "KartNose",
      "parentId": "KartChassis",
      "transform": {
        "position": [
          0,
          0.016,
          0.4
        ],
        "rotation": [
          0,
          0,
          0,
          1
        ],
        "scale": [
          0.1,
          0.1,
          0.1
        ]
      },
      "components": [
        {
          "type": "gproc",
          "graphId": "lego_brick",
          "materialIds": [
            "LK_Glass"
          ],
          "parameters": {
            "WidthStuds": 4,
            "LengthStuds": 2,
            "HeightPlates": 6,
            "Kind": "slope",
            "SlopeAngle": 33,
            "Underside": false
          }
        }
      ]
    },
    {
      "id": "KartSteer",
      "name": "KartSteer",
      "parentId": "KartChassis",
      "transform": {
        "position": [
          0,
          0.012,
          -0.12
        ],
        "rotation": [
          0,
          0,
          0.70710678,
          0.70710678
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "renderable",
          "meshId": "lk_steer",
          "materialId": "LK_Black",
          "castShadow": true
        }
      ]
    },
    {
      "id": "KartRollBar",
      "name": "KartRollBar",
      "parentId": "KartChassis",
      "transform": {
        "position": [
          0,
          0.08,
          -0.24
        ],
        "rotation": [
          0,
          0,
          0,
          1
        ],
        "scale": [
          0.1,
          0.1,
          0.1
        ]
      },
      "components": [
        {
          "type": "gproc",
          "graphId": "lego_handle_bar",
          "materialIds": [
            "LK_Yellow"
          ],
          "parameters": {
            "WidthStuds": 4,
            "HeightPlates": 6,
            "BarRadius": 0.18
          }
        }
      ]
    },
    {
      "id": "KartWheel-fl",
      "name": "KartWheel-fl",
      "parentId": "KartChassis",
      "transform": {
        "position": [
          -0.26,
          -0.1,
          0.32000000000000006
        ],
        "rotation": [
          0,
          0,
          0,
          1
        ],
        "scale": [
          0.1,
          0.1,
          0.1
        ]
      },
      "components": [
        {
          "type": "gproc",
          "graphId": "lego_wheel",
          "materialIds": [
            "LK_WheelRim",
            "LK_WheelTire"
          ],
          "parameters": {
            "OuterRadius": 1,
            "Width": 0.7,
            "ShowTread": true,
            "ShowAxleCross": true,
            "ShowSpokeHoles": true
          }
        }
      ]
    },
    {
      "id": "KartWheel-fr",
      "name": "KartWheel-fr",
      "parentId": "KartChassis",
      "transform": {
        "position": [
          0.26,
          -0.1,
          0.32000000000000006
        ],
        "rotation": [
          0,
          0,
          0,
          1
        ],
        "scale": [
          0.1,
          0.1,
          0.1
        ]
      },
      "components": [
        {
          "type": "gproc",
          "graphId": "lego_wheel",
          "materialIds": [
            "LK_WheelRim",
            "LK_WheelTire"
          ],
          "parameters": {
            "OuterRadius": 1,
            "Width": 0.7,
            "ShowTread": true,
            "ShowAxleCross": true,
            "ShowSpokeHoles": true
          }
        }
      ]
    },
    {
      "id": "KartWheel-rl",
      "name": "KartWheel-rl",
      "parentId": "KartChassis",
      "transform": {
        "position": [
          -0.26,
          -0.1,
          -0.24000000000000005
        ],
        "rotation": [
          0,
          0,
          0,
          1
        ],
        "scale": [
          0.1,
          0.1,
          0.1
        ]
      },
      "components": [
        {
          "type": "gproc",
          "graphId": "lego_wheel",
          "materialIds": [
            "LK_WheelRim",
            "LK_WheelTire"
          ],
          "parameters": {
            "OuterRadius": 1,
            "Width": 0.7,
            "ShowTread": true,
            "ShowAxleCross": true,
            "ShowSpokeHoles": true
          }
        }
      ]
    },
    {
      "id": "KartWheel-rr",
      "name": "KartWheel-rr",
      "parentId": "KartChassis",
      "transform": {
        "position": [
          0.26,
          -0.1,
          -0.24000000000000005
        ],
        "rotation": [
          0,
          0,
          0,
          1
        ],
        "scale": [
          0.1,
          0.1,
          0.1
        ]
      },
      "components": [
        {
          "type": "gproc",
          "graphId": "lego_wheel",
          "materialIds": [
            "LK_WheelRim",
            "LK_WheelTire"
          ],
          "parameters": {
            "OuterRadius": 1,
            "Width": 0.7,
            "ShowTread": true,
            "ShowAxleCross": true,
            "ShowSpokeHoles": true
          }
        }
      ]
    },
    {
      "id": "KartHolderFL",
      "name": "KartHolderFL",
      "parentId": "KartChassis",
      "transform": {
        "position": [
          -0.16,
          -0.048,
          0.32000000000000006
        ],
        "rotation": [
          0,
          1,
          0,
          0
        ],
        "scale": [
          0.1,
          0.1,
          0.1
        ]
      },
      "components": [
        {
          "type": "gproc",
          "graphId": "lego_axle_bracket",
          "materialIds": [
            "LK_Bracket"
          ],
          "parameters": {
            "PlateStuds": 2,
            "PlateThickness": 0.32,
            "WallHeight": 0.96,
            "AxleRadius": 0.11,
            "AxleLength": 1,
            "ShowStuds": true
          }
        }
      ]
    },
    {
      "id": "KartHolderFR",
      "name": "KartHolderFR",
      "parentId": "KartChassis",
      "transform": {
        "position": [
          0.16,
          -0.048,
          0.32000000000000006
        ],
        "rotation": [
          0,
          0,
          0,
          1
        ],
        "scale": [
          0.1,
          0.1,
          0.1
        ]
      },
      "components": [
        {
          "type": "gproc",
          "graphId": "lego_axle_bracket",
          "materialIds": [
            "LK_Bracket"
          ],
          "parameters": {
            "PlateStuds": 2,
            "PlateThickness": 0.32,
            "WallHeight": 0.96,
            "AxleRadius": 0.11,
            "AxleLength": 1,
            "ShowStuds": true
          }
        }
      ]
    },
    {
      "id": "KartHolderRL",
      "name": "KartHolderRL",
      "parentId": "KartChassis",
      "transform": {
        "position": [
          -0.16,
          -0.048,
          -0.24000000000000005
        ],
        "rotation": [
          0,
          1,
          0,
          0
        ],
        "scale": [
          0.1,
          0.1,
          0.1
        ]
      },
      "components": [
        {
          "type": "gproc",
          "graphId": "lego_axle_bracket",
          "materialIds": [
            "LK_Bracket"
          ],
          "parameters": {
            "PlateStuds": 2,
            "PlateThickness": 0.32,
            "WallHeight": 0.96,
            "AxleRadius": 0.11,
            "AxleLength": 1,
            "ShowStuds": true
          }
        }
      ]
    },
    {
      "id": "KartHolderRR",
      "name": "KartHolderRR",
      "parentId": "KartChassis",
      "transform": {
        "position": [
          0.16,
          -0.048,
          -0.24000000000000005
        ],
        "rotation": [
          0,
          0,
          0,
          1
        ],
        "scale": [
          0.1,
          0.1,
          0.1
        ]
      },
      "components": [
        {
          "type": "gproc",
          "graphId": "lego_axle_bracket",
          "materialIds": [
            "LK_Bracket"
          ],
          "parameters": {
            "PlateStuds": 2,
            "PlateThickness": 0.32,
            "WallHeight": 0.96,
            "AxleRadius": 0.11,
            "AxleLength": 1,
            "ShowStuds": true
          }
        }
      ]
    },
    {
      "id": "KartChaseCamera",
      "name": "KartChaseCamera",
      "parentId": null,
      "transform": {
        "position": [
          0,
          0.8,
          -1.4
        ],
        "rotation": [
          0,
          0,
          0,
          1
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "camera",
          "fov": 0.9599310885968813,
          "near": 0.25,
          "far": 120,
          "isPrimary": true,
          "isMain": true,
          "firstPersonEyeOffsetY": 0
        },
        {
          "type": "cameraController",
          "mode": "chase",
          "applyOn": "play",
          "chaseTargetEntityId": "KartChassis",
          "chaseDistance": 1.8,
          "chaseHeight": 0.7,
          "chaseLookAhead": 0.5,
          "chaseLookHeight": 0.14,
          "chaseFocusSmoothXZ": 0,
          "chaseFocusSmoothY": 0,
          "chaseYawSmooth": 0
        }
      ]
    }
  ]
};
