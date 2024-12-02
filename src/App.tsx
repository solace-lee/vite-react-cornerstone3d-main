import { useEffect, useRef } from "react"
import createImageIdsAndCacheMetaData from "./lib/createImageIdsAndCacheMetaData"
import { RenderingEngine, Enums, type Types, volumeLoader, cornerstoneStreamingImageVolumeLoader, setVolumesForViewports } from "@cornerstonejs/core"
import { init as csRenderInit } from "@cornerstonejs/core"
import {
  init as csToolsInit,
  ToolGroupManager,
  ZoomTool,
  WindowLevelTool,
  Enums as csToolsEnums,
  addTool,
  BidirectionalTool,
  segmentation,
  BrushTool,
  StackScrollTool,
  SynchronizerManager,
  synchronizers
} from "@cornerstonejs/tools"
import { init as dicomImageLoaderInit } from "@cornerstonejs/dicom-image-loader"

const { createCameraPositionSynchronizer, createVOISynchronizer } = synchronizers;


volumeLoader.registerUnknownVolumeLoader(
  cornerstoneStreamingImageVolumeLoader
)

function App() {
  const elementRef = useRef<HTMLDivElement>(null)
  const elementRef1 = useRef<HTMLDivElement>(null)
  const elementRef2 = useRef<HTMLDivElement>(null)
  const running = useRef(false)

  useEffect(() => {
    const setup = async () => {
      if (running.current) {
        return
      }
      running.current = true

      await csRenderInit()
      await csToolsInit()
      dicomImageLoaderInit({ maxWebWorkers: 1 })

      // Get Cornerstone imageIds and fetch metadata into RAM
      const imageIds = await createImageIdsAndCacheMetaData({
        StudyInstanceUID:
          "1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463",
        SeriesInstanceUID:
          "1.3.6.1.4.1.14519.5.2.1.7009.2403.226151125820845824875394858561",
        wadoRsRoot: "https://d3t6nz73ql33tx.cloudfront.net/dicomweb",
      })

      // Instantiate a rendering engine
      const renderingEngineId = "myRenderingEngine"
      const renderingEngine = new RenderingEngine(renderingEngineId)
      const viewportId = "CT_SAGITTAL"
      const viewportId1 = "CT_AXIAL"
      const viewportId2 = "CT_CORONAL"
      const segmentationId = 'MY_SEGMENTATION_ID';

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
      }
      ]

      // renderingEngine.enableElement(viewportInput)
      renderingEngine.setViewports(viewportInput)

      // Get the stack viewport that was created
      // const viewport = renderingEngine.getViewport(viewportId) as Types.IVolumeViewport

      // Define a volume in memory
      const volumeId = "streamingImageVolume"
      const volume = await volumeLoader.createAndCacheVolume(volumeId, {
        imageIds,
      })

      await volumeLoader.createAndCacheDerivedLabelmapVolume(volumeId, {
        volumeId: segmentationId,
      });

      segmentation.addSegmentations([
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

      // Set the volume to load
      volume.load()
      setVolumesForViewports(
        renderingEngine,
        [{
          volumeId,
          callback: ({ volumeActor }) => {
            // set the windowLevel after the volumeActor is created
            console.log(volumeActor);

            volumeActor
              .getProperty()
              .getRGBTransferFunction(0)
              .setMappingRange(-180, 220);
          },
        }],
        viewportInput.map((vp) => vp.viewportId)
      )


      setTimeout(() => {
        setSync(viewportInput, renderingEngine)
      }, 5000)
      await addTools(viewportInput.map((vp) => vp.viewportId), renderingEngineId, segmentationId)
      // Set the volume on the viewport and it's default properties
      // viewport.setVolumes([{ volumeId }])
      renderingEngine.renderViewports(viewportInput.map((vp) => vp.viewportId));
      // Render the image
      // viewport.render()
    }

    setup()

    // Create a stack viewport
  }, [elementRef, running])

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
    </>
  )
}

export default App
