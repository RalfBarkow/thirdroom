import { addEntity, createWorld } from "bitecs";

import { addChild, addTransformComponent } from "./component/transform";
import { maxEntities, tickRate } from "./config.common";
import { InitializeGameWorkerMessage, WorkerMessages, WorkerMessageType } from "./WorkerMessage";
import { Message, registerModules, Thread } from "./module/module.common";
import gameConfig from "./config.game";
import { GameState, World } from "./GameTypes";
import { swapReadBufferFlags, swapWriteBufferFlags } from "./allocator/TripleBuffer";

const workerScope = globalThis as typeof globalThis & Worker;

async function onInitMessage({ data }: { data: WorkerMessages }) {
  if (typeof data !== "object") {
    return;
  }

  const message = data as WorkerMessages;

  if (message.type === WorkerMessageType.InitializeGameWorker) {
    workerScope.removeEventListener("message", onInitMessage);
    onInit(message);
  }
}

workerScope.addEventListener("message", onInitMessage);

async function onInit({
  renderWorkerMessagePort,
  mainToGameTripleBufferFlags,
  gameToMainTripleBufferFlags,
  gameToRenderTripleBufferFlags,
}: InitializeGameWorkerMessage) {
  const renderPort = renderWorkerMessagePort || workerScope;

  const world = createWorld<World>(maxEntities);

  // noop entity
  addEntity(world);

  const scene = addEntity(world);
  addTransformComponent(world, scene);

  const camera = addEntity(world);
  addTransformComponent(world, camera);
  addChild(scene, camera);

  function gameWorkerSendMessage<M extends Message<any>>(thread: Thread, message: M, transferList: Transferable[]) {
    if (thread === Thread.Main) {
      workerScope.postMessage(message, transferList);
    } else if (thread === Thread.Render) {
      renderPort.postMessage(message, transferList);
    }
  }

  const state: GameState = {
    mainToGameTripleBufferFlags,
    gameToMainTripleBufferFlags,
    gameToRenderTripleBufferFlags,
    renderPort,
    elapsed: performance.now(),
    dt: 0,
    world,
    activeScene: scene,
    activeCamera: camera,
    systems: gameConfig.systems,
    messageHandlers: new Map(),
    modules: new Map(),
    sendMessage: gameWorkerSendMessage,
  };

  const onMessage = ({ data }: MessageEvent) => {
    if (typeof data !== "object") {
      return;
    }

    const message = data as WorkerMessages;

    const handlers = state.messageHandlers.get(message.type);

    if (handlers) {
      for (let i = 0; i < handlers.length; i++) {
        handlers[i](state, message);
      }
    }
  };

  workerScope.addEventListener("message", onMessage);

  if (renderWorkerMessagePort) {
    renderWorkerMessagePort.addEventListener("message", onMessage);
  }

  // Sends message to main thread saying we're ready to register modules (send modules in message)
  // Initially blocks until main thread tells game thread to register modules
  // Register all modules
  // Then wait for main thread to start this worker and we call update()
  const modulePromise = registerModules(Thread.Game, state, gameConfig.modules);

  if (renderWorkerMessagePort) {
    renderWorkerMessagePort.start();
  }

  await modulePromise;

  console.log("GameWorker initialized");

  setInterval(() => {
    update(state);
  }, 1000 / tickRate);
}

// timeoutOffset: ms to subtract from the dynamic timeout to make sure we are always updating around 60hz
// ex. Our game loop should be called every 16.666ms, it took 3ms this frame.
// We could schedule the timeout for 13.666ms, but it would likely be scheduled about  3ms later.
// So subtract 3-4ms from that timeout to make sure it always swaps the buffers in under 16.666ms.
// const timeoutOffset = 1;

function update(ctx: GameState) {
  const now = performance.now();
  ctx.dt = (now - ctx.elapsed) / 1000;
  ctx.elapsed = now;

  swapReadBufferFlags(ctx.mainToGameTripleBufferFlags);

  for (let i = 0; i < ctx.systems.length; i++) {
    ctx.systems[i](ctx);
  }

  swapWriteBufferFlags(ctx.gameToMainTripleBufferFlags);
  swapWriteBufferFlags(ctx.gameToRenderTripleBufferFlags);

  // const frameDuration = performance.now() - state.elapsed;
  // const remainder = Math.max(1000 / tickRate - frameDuration - timeoutOffset, 0);

  // setTimeout(() => update(state), remainder);
}
