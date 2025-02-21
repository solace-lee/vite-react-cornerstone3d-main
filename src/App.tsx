import { useEffect, useRef } from "react"
import createImageIdsAndCacheMetaData from "./lib/createImageIdsAndCacheMetaData"
import {
  RenderingEngine,
  CONSTANTS,
  Enums,
  type Types,
  volumeLoader,
  cornerstoneStreamingImageVolumeLoader,
  setVolumesForViewports,
  getEnabledElement,
  init as csRenderInit,
  VolumeViewport3D,
  getRenderingEngine
} from "@cornerstonejs/core"
import {
  init as csToolsInit,
  ToolGroupManager,
  ZoomTool,
  WindowLevelTool,
  Enums as csToolsEnums,
  addTool,
  LengthTool,
  TrackballRotateTool,
  BidirectionalTool,
  segmentation,
  BrushTool,
  PanTool,
  StackScrollTool,
  SynchronizerManager,
  synchronizers,
  type Types as csToolsTypes,
} from "@cornerstonejs/tools"
import { init as dicomImageLoaderInit } from "@cornerstonejs/dicom-image-loader"

const { createCameraPositionSynchronizer, createVOISynchronizer } = synchronizers;

const { MouseBindings, KeyboardBindings } = csToolsEnums;

volumeLoader.registerUnknownVolumeLoader(
  cornerstoneStreamingImageVolumeLoader
)

const renderingEngineId = "myRenderingEngine"
const threeId = 'threeDViewportId';
const rendering3DEngineId = 'my3DRenderingEngine';

const volumeId = "streamingImageVolume"
const segmentationId = 'MY_SEGMENTATION_ID';


function App() {
  const elementRef = useRef<HTMLDivElement>(null)
  const elementRef1 = useRef<HTMLDivElement>(null)
  const elementRef2 = useRef<HTMLDivElement>(null)
  const threeDRef = useRef<HTMLDivElement>(null)
  const running = useRef(false)

  useEffect(() => {
    setup()
    // Create a stack viewport
  }, [elementRef, running])

  async function init3D() {
    // const canvas = document.createElement('canvas');
    // canvas.style.width = '100%';
    // canvas.style.height = '100%';
    // threeDRef.current.appendChild(canvas);

    // const renderingEngine = getRenderingEngine(renderingEngineId);
    const toolGroupId = 'TOOL_GROUP_ID';

    // Define a tool group, which defines how mouse events map to tool commands for
    // Any viewport using the group
    const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);

    // Add the tools to the tool group and specify which volume they are pointing at
    addManipulationBindings(toolGroup, {
      is3DViewport: true,
    });

    toolGroup.addViewport(threeId, renderingEngineId);



    // renderingEngine.renderViewports([threeId]);
  }

  async function initMPR() {
    volumeLoader.createAndCacheDerivedLabelmapVolume(volumeId, {
      volumeId: segmentationId,
    });

    // Instantiate a rendering engine
    const renderingEngine = new RenderingEngine(renderingEngineId)
    const viewportId = "CT_SAGITTAL"
    const viewportId1 = "CT_AXIAL"
    const viewportId2 = "CT_CORONAL"

    const viewportInput = [{
      viewportId,
      type: Enums.ViewportType.ORTHOGRAPHIC,
      element: elementRef.current,
      defaultOptions: {
        orientation: Enums.OrientationAxis.SAGITTAL,
      },
    },
    {
      viewportId: viewportId1,
      type: Enums.ViewportType.ORTHOGRAPHIC,
      element: elementRef1.current,
      defaultOptions: {
        orientation: Enums.OrientationAxis.AXIAL,
      },
    },
    {
      viewportId: viewportId2,
      type: Enums.ViewportType.ORTHOGRAPHIC,
      element: elementRef2.current,
      defaultOptions: {
        orientation: Enums.OrientationAxis.CORONAL,
      },
    },
    {
      viewportId: threeId,
      type: Enums.ViewportType.VOLUME_3D,
      element: threeDRef.current,
      defaultOptions: {
        orientation: Enums.OrientationAxis.CORONAL,
        background: CONSTANTS.BACKGROUND_COLORS.slicer3D,
      },
    }
    ]

    // renderingEngine.enableElement(viewportInput)
    renderingEngine.setViewports(viewportInput)

    segmentation.addSegmentations([
      {
        segmentationId,
        representation: {
          type: csToolsEnums.SegmentationRepresentations.Labelmap,
          data: {
            volumeId: segmentationId,
          },
        },
      },
    ]);

    const MPRViewPorts = [viewportId, viewportId1, viewportId2];

    setTimeout(() => {
      setSync(viewportInput, renderingEngine)
    }, 5000)

    await addTools(MPRViewPorts, renderingEngineId, segmentationId)

    await setVolumesForViewports(
      renderingEngine,
      [{
        volumeId,
        callback: ({ volumeActor }) => {
          volumeActor
            .getProperty()
            .getRGBTransferFunction(0)
            .setMappingRange(-180, 220);
        },
      }],
      viewportInput.map((vp) => vp.viewportId)
    )

    const viewport = renderingEngine.getViewport(threeId);

    viewport.setProperties({
      preset: 'CT-Bone',
    });
    viewport.render();

    renderingEngine.renderViewports(viewportInput.map((vp) => vp.viewportId));
  }

  const setup = async () => {
    if (running.current) {
      return
    }
    running.current = true

    await csRenderInit()
    await csToolsInit()
    dicomImageLoaderInit({ maxWebWorkers: 6 })

    // Get Cornerstone imageIds and fetch metadata into RAM
    const imageIds = await createImageIdsAndCacheMetaData({
      StudyInstanceUID:
        "1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463",
      SeriesInstanceUID:
        "1.3.6.1.4.1.14519.5.2.1.7009.2403.226151125820845824875394858561",
      wadoRsRoot: "https://d3t6nz73ql33tx.cloudfront.net/dicomweb",
    })

    const volume = await volumeLoader.createAndCacheVolume(volumeId, {
      imageIds,
    })
    volume.load()

    await initMPR()
    init3D()
  }

  function setSync(viewportIds: any[], renderingEngine: any) {
    // const axialSync = createCameraPositionSynchronizer('axialSync');
    // viewportIds.forEach((vp) => {
    //   const { viewportId } = vp;
    //   const id = renderingEngine.getViewport(viewportId).id
    //   axialSync.add({ renderingEngineId: renderingEngine.id, viewportId: id });
    // });


    const ctWLSync = createVOISynchronizer('ctWLSync', { syncInvertState: true, syncColormap: true });

    viewportIds.forEach((viewport) => {
      const { viewportId } = viewport;
      ctWLSync.add({ renderingEngineId: renderingEngine.id, viewportId });
    });

    // const cameraPositionSynchronizer = SynchronizerManager.createSynchronizer(
    //   'synchronizerName',
    //   Enums.Events.CAMERA_MODIFIED,
    //   (
    //     synchronizerInstance,
    //     sourceViewport,
    //     targetViewport,
    //     cameraModifiedEvent
    //   ) => {
    //     console.log('哈哈哈', synchronizerInstance, sourceViewport, targetViewport, cameraModifiedEvent);

    //     // Synchronization logic should go here
    //   }
    // );

    // console.log('哈哈哈', cameraPositionSynchronizer);


    // // 添加视图
    // viewportIds.forEach((id, index) => {
    //   if (index) {
    //     cameraPositionSynchronizer.addTarget({ renderingEngineId, viewportId: id });
    //   } else {
    //     cameraPositionSynchronizer.addSource({ renderingEngineId, viewportId: id });
    //   }
    // })
  }


  async function addTools(viewportIds: string[], renderingEngineId: string, segmentationId: string) {
    addTool(ZoomTool);
    addTool(WindowLevelTool);
    addTool(BidirectionalTool);
    addTool(BidirectionalTool);
    addTool(BrushTool);
    addTool(StackScrollTool)

    const toolGroupId = 'myToolGroup'
    const toolGroup = ToolGroupManager.createToolGroup(toolGroupId)


    toolGroup.addTool(ZoomTool.toolName)
    toolGroup.addTool(WindowLevelTool.toolName)
    toolGroup.addTool(BidirectionalTool.toolName);
    toolGroup.addTool(BrushTool.toolName);
    toolGroup.addTool(StackScrollTool.toolName);

    viewportIds.forEach(id => {
      segmentation.addSegmentationRepresentations(id, [
        {
          segmentationId,
          type: csToolsEnums.SegmentationRepresentations.Labelmap,
        },
      ]);
      toolGroup.addViewport(id, renderingEngineId)
    })
    toolGroup.setToolActive(BrushTool.toolName, {
      bindings: [
        {
          mouseButton: csToolsEnums.MouseBindings.Primary, // Left Click
        },
      ],
    });
    toolGroup.setToolActive(WindowLevelTool.toolName, {
      bindings: [
        {
          mouseButton: csToolsEnums.MouseBindings.Secondary, // Left Click
        },
      ],
    });

    toolGroup.setToolActive(StackScrollTool.toolName, {
      bindings: [
        {
          mouseButton: csToolsEnums.MouseBindings.Wheel, // Right Click
        },
      ],
    });
  }

  function addManipulationBindings(toolGroup: any, options: any) {
    const zoomBindings: csToolsTypes.IToolBinding[] = [
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
        modifierKey: KeyboardBindings.Shift,
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

  return (
    <>
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
    </>
  )
}

export default App
