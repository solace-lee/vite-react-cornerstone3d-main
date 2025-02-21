import { useEffect, useRef } from "react"
import type { Types } from '@cornerstonejs/core';
import createImageIdsAndCacheMetaData from "./lib/createImageIdsAndCacheMetaData"
import { init as dicomImageLoaderInit } from "@cornerstonejs/dicom-image-loader"

import {
  RenderingEngine,
  Enums,
  setVolumesForViewports,
  volumeLoader,
  CONSTANTS,
  utilities,
  init as csRenderInit,
  eventTarget,
  getRenderingEngine,
} from '@cornerstonejs/core';
// import {
//   initDemo,
//   createImageIdsAndCacheMetaData,
//   setTitleAndDescription,
//   setCtTransferFunctionForVolumeActor,
//   addButtonToToolbar,
//   addDropdownToToolbar,
//   addToggleButtonToToolbar,
//   createInfoSection,
//   addManipulationBindings,
//   addLabelToToolbar,
// } from '../../../../utils/demo/helpers';
import * as cornerstoneTools from '@cornerstonejs/tools';

const {
  ToolGroupManager,
  Enums: csToolsEnums,
  segmentation,
  BrushTool,
  LengthTool,
  TrackballRotateTool,
  BidirectionalTool,
  PanTool,
  ZoomTool,
  StackScrollTool,
  addTool
} = cornerstoneTools;

const { MouseBindings, KeyboardBindings } = csToolsEnums;
const { ViewportType } = Enums;

const volumeName = 'CT_VOLUME_ID'; // Id of the volume less loader prefix
const volumeLoaderScheme = 'cornerstoneStreamingImageVolume'; // Loader id which defines which volume loader to use
const volumeId = `${volumeLoaderScheme}:${volumeName}`; // VolumeId with loader id + volume id
const segmentationId = 'MY_SEGMENTATION_ID';

const renderingEngineId = 'myRenderingEngine';

const toolGroupId = 'ToolGroup_MPR';
const toolGroupId2 = 'ToolGroup_3D';
// let renderingEngine;
// Create the viewports
const viewportId1 = 'CT_AXIAL';
const viewportId2 = 'CT_SAGITTAL';
const viewportId3 = 'CT_3D';

const segmentIndexes = [1, 2, 3, 4, 5];

let initStatus = false

function Surface() {
  const elementRef = useRef<HTMLDivElement>(null)
  const elementRef1 = useRef<HTMLDivElement>(null)
  const elementRef2 = useRef<HTMLDivElement>(null)
  const threeDRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    init()
  }, [])

  async function init() {
    if (initStatus) return;
    initStatus = true
    await csRenderInit()
    await cornerstoneTools.init()
    dicomImageLoaderInit({ maxWebWorkers: 6 })

    await initVolume()

    await initMPR()
    initTools()

    await initSegment()

  }

  async function convert() {
    console.log('哈哈哈', import.meta.url);

    await segmentation.addSegmentationRepresentations(viewportId3, [
      {
        segmentationId,
        type: csToolsEnums.SegmentationRepresentations.Surface,
      },
    ]);
  }

  async function initSegment() {
    const renderingEngine = getRenderingEngine(renderingEngineId);
    const volumeActor = renderingEngine.getViewport(viewportId3).getDefaultActor()
      .actor as Types.VolumeActor;
    utilities.applyPreset(
      volumeActor,
      CONSTANTS.VIEWPORT_PRESETS.find((preset) => preset.name === 'CT-Bone')
    );
    volumeActor.setVisibility(false);

    // Add some segmentations based on the source data volume
    // Create a segmentation of the same resolution as the source data
    // volumeLoader.createAndCacheDerivedLabelmapVolume(volumeId, {
    //   volumeId: segmentationId,
    // });

    await segmentation.addSegmentations([
      {
        segmentationId,
        representation: {
          // The type of segmentation
          type: csToolsEnums.SegmentationRepresentations.Labelmap,
          // The actual segmentation data, in the case of labelmap this is a
          // reference to the source volume of the segmentation.
          data: {
            volumeId: segmentationId,
          },
        },
      },
    ]);

    // Add the segmentation representation to the viewports
    const segmentationRepresentation = {
      segmentationId,
      type: csToolsEnums.SegmentationRepresentations.Labelmap,
    };

    await segmentation.addLabelmapRepresentationToViewportMap({
      [viewportId1]: [segmentationRepresentation],
      [viewportId2]: [segmentationRepresentation],
    });

    // Render the image
    renderingEngine.render();
  }

  async function initMPR() {

    volumeLoader.createAndCacheDerivedLabelmapVolume(volumeId, {
      volumeId: segmentationId,
    });

    const renderingEngine = new RenderingEngine(renderingEngineId);
    const viewportInputArray = [
      {
        viewportId: viewportId1,
        type: ViewportType.ORTHOGRAPHIC,
        element: elementRef.current,
        defaultOptions: {
          orientation: Enums.OrientationAxis.AXIAL,
        },
      },
      {
        viewportId: viewportId2,
        type: ViewportType.ORTHOGRAPHIC,
        element: elementRef1.current,
        defaultOptions: {
          orientation: Enums.OrientationAxis.SAGITTAL,
        },
      },
      {
        viewportId: viewportId3,
        type: ViewportType.VOLUME_3D,
        element: threeDRef.current,
        defaultOptions: {
          // background: CONSTANTS.BACKGROUND_COLORS.slicer3D,
        },
      },
    ];

    renderingEngine.setViewports(viewportInputArray);

    await setVolumesForViewports(
      renderingEngine,
      [{ volumeId, callback: setCtTransferFunctionForVolumeActor }],
      [viewportId1, viewportId2, viewportId3]
    );
  }

  async function initVolume() {

    const imageIds = await createImageIdsAndCacheMetaData({
      StudyInstanceUID:
        '1.3.12.2.1107.5.2.32.35162.30000015050317233592200000046',
      SeriesInstanceUID:
        '1.3.12.2.1107.5.2.32.35162.1999123112191238897317963.0.0.0',
      wadoRsRoot: 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
    });

    const volume = await volumeLoader.createAndCacheVolume(volumeId, {
      imageIds,
    });
    volume.load();
  }

  function initTools() {
    cornerstoneTools.addTool(BrushTool);

    const toolGroup1 = ToolGroupManager.createToolGroup(toolGroupId);
    const toolGroup2 = ToolGroupManager.createToolGroup(toolGroupId2);


    addManipulationBindings(toolGroup1, { is3DViewport: false });
    addManipulationBindings(toolGroup2, { is3DViewport: true });

    toolGroup1.addToolInstance('SphereBrush', BrushTool.toolName, {
      activeStrategy: 'FILL_INSIDE_SPHERE',
    });
    toolGroup1.addToolInstance('EraserBrush', BrushTool.toolName, {
      activeStrategy: 'ERASE_INSIDE_SPHERE',
    });

    toolGroup1.setToolActive('SphereBrush', {
      bindings: [
        {
          mouseButton: MouseBindings.Primary, // Middle Click
        },
      ],
    });

    toolGroup1.addViewport(viewportId1, renderingEngineId);
    toolGroup1.addViewport(viewportId2, renderingEngineId);
    toolGroup2.addViewport(viewportId3, renderingEngineId);
  }

  return (
    <div>
      <button onClick={convert}>重建</button>
      <div
        ref={elementRef}
        style={{
          width: "512px",
          height: "512px",
          backgroundColor: "#000",
        }}
      ></div>
      <div
        ref={elementRef1}
        style={{
          width: "512px",
          height: "512px",
          backgroundColor: "#000",
        }}
      ></div>
      <div
        ref={elementRef2}
        style={{
          width: "512px",
          height: "512px",
          backgroundColor: "#000",
        }}
      ></div>
      <div
        ref={threeDRef}
        style={{
          width: "512px",
          height: "512px",
          backgroundColor: "#000",
        }}
      />
    </div>
  )
}


const windowWidth = 400;
const windowCenter = 40;

const lower = windowCenter - windowWidth / 2.0;
const upper = windowCenter + windowWidth / 2.0;

const ctVoiRange = { lower, upper };

function setCtTransferFunctionForVolumeActor({ volumeActor }) {
  volumeActor
    .getProperty()
    .getRGBTransferFunction(0)
    .setMappingRange(lower, upper);
}

function addManipulationBindings(toolGroup: any, options: any) {
  const zoomBindings: cornerstoneTools.Types.IToolBinding[] = [
    {
      mouseButton: MouseBindings.Secondary,
    },
  ];

  const {
    is3DViewport = false,
    enableShiftClickZoom = false,
    toolMap = new Map(),
  } = options;

  if (enableShiftClickZoom === true) {
    zoomBindings.push({
      mouseButton: MouseBindings.Primary, // Shift Left Click
      modifierKey: csToolsEnums.KeyboardBindings.Shift,
    });
  }

  addTool(PanTool);
  addTool(ZoomTool);
  addTool(TrackballRotateTool);
  addTool(LengthTool);
  addTool(StackScrollTool);
  for (const [, config] of toolMap) {
    if (config.tool) {
      addTool(config.tool);
    }
  }


  toolGroup.addTool(PanTool.toolName);
  // Allow significant zooming to occur
  toolGroup.addTool(ZoomTool.toolName, {
    minZoomScale: 0.001,
    maxZoomScale: 4000,
  });
  if (is3DViewport) {
    toolGroup.addTool(TrackballRotateTool.toolName);
  } else {
    toolGroup.addTool(StackScrollTool.toolName);
  }
  toolGroup.addTool(LengthTool.toolName);
  toolGroup.addTool(StackScrollTool.toolName);

  toolGroup.setToolActive(PanTool.toolName, {
    bindings: [
      {
        mouseButton: MouseBindings.Auxiliary,
      },
      {
        numTouchPoints: 1,
        modifierKey: KeyboardBindings.Ctrl,
      },
    ],
  });
  toolGroup.setToolActive(ZoomTool.toolName, {
    bindings: zoomBindings,
  });
  // Need a binding to navigate without a wheel mouse
  toolGroup.setToolActive(StackScrollTool.toolName, {
    bindings: [
      {
        mouseButton: MouseBindings.Primary,
        modifierKey: KeyboardBindings.Alt,
      },
      {
        numTouchPoints: 1,
        modifierKey: KeyboardBindings.Alt,
      },
      {
        mouseButton: MouseBindings.Wheel,
      },
    ],
  });
  // Add a length tool binding to allow testing annotations on examples targetting
  // other use cases.  Use a primary button with shift+ctrl as that is relatively
  // unlikely to be otherwise used.
  toolGroup.setToolActive(LengthTool.toolName, {
    bindings: [
      {
        mouseButton: MouseBindings.Primary,
        modifierKey: KeyboardBindings.ShiftCtrl,
      },
      {
        numTouchPoints: 1,
        modifierKey: KeyboardBindings.ShiftCtrl,
      },
    ],
  });

  if (is3DViewport) {
    toolGroup.setToolActive(TrackballRotateTool.toolName, {
      bindings: [
        {
          mouseButton: MouseBindings.Primary,
        },
      ],
    });
  } else {
    toolGroup.setToolActive(StackScrollTool.toolName);
  }

  for (const [toolName, config] of toolMap) {
    if (config.baseTool) {
      if (!toolGroup.hasTool(config.baseTool)) {
        toolGroup.addTool(
          config.baseTool,
          toolMap.get(config.baseTool)?.configuration
        );
      }
      toolGroup.addToolInstance(
        toolName,
        config.baseTool,
        config.configuration
      );
    } else if (!toolGroup.hasTool(toolName)) {
      toolGroup.addTool(toolName, config.configuration);
    }
    if (config.passive) {
      toolGroup.setToolPassive(toolName);
    }
    if (config.bindings || config.selected) {
      toolGroup.setToolActive(
        toolName,
        (config.bindings && config) || {
          bindings: [{ mouseButton: MouseBindings.Primary }],
        }
      );
    }
  }
}

export default Surface;
