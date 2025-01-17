import { addEntity } from "bitecs";
import { vec3 } from "gl-matrix";

import {
  commitToObjectTripleBuffer,
  createObjectBufferView,
  createObjectTripleBuffer,
  ObjectBufferView,
} from "../allocator/ObjectBufferView";
import { addTransformComponent, addChild } from "../component/transform";
import { GameState } from "../GameTypes";
import { getModule, Thread } from "../module/module.common";
import { addRemoteNodeComponent } from "../node/node.game";
import { RendererModule } from "../renderer/renderer.game";
import { ResourceId } from "../resource/resource.common";
import { createResource } from "../resource/resource.game";
import {
  DirectionalLightResourceType,
  directionalLightSchema,
  DirectionalLightTripleBuffer,
  LightType,
  PointLightResourceType,
  pointLightSchema,
  PointLightTripleBuffer,
  SharedDirectionalLightResource,
  SharedPointLightResource,
  SharedSpotLightResource,
  SpotLightResourceType,
  spotLightSchema,
  SpotLightTripleBuffer,
} from "./light.common";

export type DirectionalLightBufferView = ObjectBufferView<typeof directionalLightSchema, ArrayBuffer>;
export type PointLightBufferView = ObjectBufferView<typeof pointLightSchema, ArrayBuffer>;
export type SpotLightBufferView = ObjectBufferView<typeof spotLightSchema, ArrayBuffer>;

export interface RemoteDirectionalLight {
  name: string;
  resourceId: ResourceId;
  type: LightType.Directional;
  lightBufferView: DirectionalLightBufferView;
  lightTripleBuffer: DirectionalLightTripleBuffer;
  get color(): vec3;
  set color(value: vec3);
  get intensity(): number;
  set intensity(value: number);
  get castShadow(): boolean;
  set castShadow(value: boolean);
}

export interface RemotePointLight {
  name: string;
  resourceId: ResourceId;
  type: LightType.Point;
  lightBufferView: PointLightBufferView;
  lightTripleBuffer: PointLightTripleBuffer;
  get color(): vec3;
  set color(value: vec3);
  get intensity(): number;
  set intensity(value: number);
  get range(): number;
  set range(value: number);
  get castShadow(): boolean;
  set castShadow(value: boolean);
}

export interface RemoteSpotLight {
  name: string;
  resourceId: ResourceId;
  type: LightType.Spot;
  lightBufferView: SpotLightBufferView;
  lightTripleBuffer: SpotLightTripleBuffer;
  get color(): vec3;
  set color(value: vec3);
  get intensity(): number;
  set intensity(value: number);
  get range(): number;
  set range(value: number);
  get innerConeAngle(): number;
  set innerConeAngle(value: number);
  get outerConeAngle(): number;
  set outerConeAngle(value: number);
  get castShadow(): boolean;
  set castShadow(value: boolean);
}

export type RemoteLight = RemoteDirectionalLight | RemotePointLight | RemoteSpotLight;

export function updateRemoteDirectionalLights(directionalLights: RemoteDirectionalLight[]) {
  for (let i = 0; i < directionalLights.length; i++) {
    const directionalLight = directionalLights[i];
    commitToObjectTripleBuffer(directionalLight.lightTripleBuffer, directionalLight.lightBufferView);
  }
}

export function updateRemotePointLights(pointLights: RemotePointLight[]) {
  for (let i = 0; i < pointLights.length; i++) {
    const pointLight = pointLights[i];
    commitToObjectTripleBuffer(pointLight.lightTripleBuffer, pointLight.lightBufferView);
  }
}

export function updateRemoteRemoteSpotLights(spotLights: RemoteSpotLight[]) {
  for (let i = 0; i < spotLights.length; i++) {
    const spotLight = spotLights[i];
    commitToObjectTripleBuffer(spotLight.lightTripleBuffer, spotLight.lightBufferView);
  }
}

export interface DirectionalLightProps {
  name?: string;
  color?: vec3;
  intensity?: number;
  castShadow?: boolean;
}

const DEFAULT_DIRECTIONAL_LIGHT_NAME = "Directional Light";

export function createDirectionalLightResource(ctx: GameState, props?: DirectionalLightProps): RemoteDirectionalLight {
  const rendererModule = getModule(ctx, RendererModule);

  const lightBufferView = createObjectBufferView(directionalLightSchema, ArrayBuffer);

  lightBufferView.color.set(props?.color || [1, 1, 1]);
  lightBufferView.intensity[0] = props?.intensity === undefined ? 1 : props.intensity;
  lightBufferView.castShadow[0] = props?.castShadow ? 1 : 0;

  const lightTripleBuffer = createObjectTripleBuffer(directionalLightSchema, ctx.gameToRenderTripleBufferFlags);

  const name = props?.name || DEFAULT_DIRECTIONAL_LIGHT_NAME;

  const resourceId = createResource<SharedDirectionalLightResource>(
    ctx,
    Thread.Render,
    DirectionalLightResourceType,
    {
      type: LightType.Directional,
      lightTripleBuffer,
    },
    {
      name,
      dispose() {
        const index = rendererModule.directionalLights.findIndex((light) => light.resourceId === resourceId);

        if (index !== -1) {
          rendererModule.directionalLights.splice(index, 1);
        }
      },
    }
  );

  const remoteLight: RemoteDirectionalLight = {
    name,
    resourceId,
    lightBufferView,
    lightTripleBuffer,
    type: LightType.Directional,
    get color(): vec3 {
      return lightBufferView.color;
    },
    set color(value: vec3) {
      lightBufferView.color.set(value);
    },
    get intensity(): number {
      return lightBufferView.intensity[0];
    },
    set intensity(value: number) {
      lightBufferView.intensity[0] = value;
    },
    get castShadow(): boolean {
      return !!lightBufferView.castShadow[0];
    },
    set castShadow(value: boolean) {
      lightBufferView.castShadow[0] = value ? 1 : 0;
    },
  };

  rendererModule.directionalLights.push(remoteLight);

  return remoteLight;
}

export interface PointLightProps {
  name?: string;
  color?: vec3;
  intensity?: number;
  range?: number;
  castShadow?: boolean;
}

const DEFAULT_POINT_LIGHT_NAME = "Point Light";

export function createPointLightResource(ctx: GameState, props?: PointLightProps): RemotePointLight {
  const rendererModule = getModule(ctx, RendererModule);

  const lightBufferView = createObjectBufferView(pointLightSchema, ArrayBuffer);

  lightBufferView.color.set(props?.color || [1, 1, 1]);
  lightBufferView.intensity[0] = props?.intensity === undefined ? 1 : props.intensity;
  lightBufferView.range[0] = props?.range || 0;
  lightBufferView.castShadow[0] = props?.castShadow ? 1 : 0;

  const lightTripleBuffer = createObjectTripleBuffer(pointLightSchema, ctx.gameToMainTripleBufferFlags);

  const name = props?.name || DEFAULT_POINT_LIGHT_NAME;

  const resourceId = createResource<SharedPointLightResource>(
    ctx,
    Thread.Render,
    PointLightResourceType,
    {
      type: LightType.Point,
      lightTripleBuffer,
    },
    {
      name,
      dispose() {
        const index = rendererModule.pointLights.findIndex((light) => light.resourceId === resourceId);

        if (index !== -1) {
          rendererModule.pointLights.splice(index, 1);
        }
      },
    }
  );

  const remoteLight: RemotePointLight = {
    name,
    resourceId,
    lightBufferView,
    lightTripleBuffer,
    type: LightType.Point,
    get color(): vec3 {
      return lightBufferView.color;
    },
    set color(value: vec3) {
      lightBufferView.color.set(value);
    },
    get intensity(): number {
      return lightBufferView.intensity[0];
    },
    set intensity(value: number) {
      lightBufferView.intensity[0] = value;
    },
    get range(): number {
      return lightBufferView.range[0];
    },
    set range(value: number) {
      lightBufferView.range[0] = value;
    },
    get castShadow(): boolean {
      return !!lightBufferView.castShadow[0];
    },
    set castShadow(value: boolean) {
      lightBufferView.castShadow[0] = value ? 1 : 0;
    },
  };

  rendererModule.pointLights.push(remoteLight);

  return remoteLight;
}

export interface SpotLightProps {
  name?: string;
  color?: vec3;
  intensity?: number;
  range?: number;
  innerConeAngle?: number;
  outerConeAngle?: number;
  castShadow?: boolean;
}

const DEFAULT_SPOT_LIGHT_NAME = "Spot Light";

export function createSpotLightResource(ctx: GameState, props?: SpotLightProps): RemoteSpotLight {
  const rendererModule = getModule(ctx, RendererModule);

  const lightBufferView = createObjectBufferView(spotLightSchema, ArrayBuffer);

  // https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_lights_punctual/schema/light.spot.schema.json
  lightBufferView.color.set(props?.color || [1, 1, 1]);
  lightBufferView.intensity[0] = props?.intensity === undefined ? 1 : props.intensity;
  lightBufferView.range[0] = props?.range || 0;
  lightBufferView.innerConeAngle[0] = props?.innerConeAngle || 0;
  lightBufferView.outerConeAngle[0] = props?.outerConeAngle === undefined ? 0.7853981633974483 : props.outerConeAngle;
  lightBufferView.castShadow[0] = props?.castShadow ? 1 : 0;

  const lightTripleBuffer = createObjectTripleBuffer(spotLightSchema, ctx.gameToRenderTripleBufferFlags);

  const name = props?.name || DEFAULT_SPOT_LIGHT_NAME;

  const resourceId = createResource<SharedSpotLightResource>(
    ctx,
    Thread.Render,
    SpotLightResourceType,
    {
      type: LightType.Spot,
      lightTripleBuffer,
    },
    {
      name,
      dispose() {
        const index = rendererModule.spotLights.findIndex((light) => light.resourceId === resourceId);

        if (index !== -1) {
          rendererModule.spotLights.splice(index, 1);
        }
      },
    }
  );

  const remoteLight: RemoteSpotLight = {
    name,
    resourceId,
    lightBufferView,
    lightTripleBuffer,
    type: LightType.Spot,
    get color(): vec3 {
      return lightBufferView.color;
    },
    set color(value: vec3) {
      lightBufferView.color.set(value);
    },
    get intensity(): number {
      return lightBufferView.intensity[0];
    },
    set intensity(value: number) {
      lightBufferView.intensity[0] = value;
    },
    get range(): number {
      return lightBufferView.range[0];
    },
    set range(value: number) {
      lightBufferView.range[0] = value;
    },
    get innerConeAngle(): number {
      return lightBufferView.innerConeAngle[0];
    },
    set innerConeAngle(value: number) {
      lightBufferView.innerConeAngle[0] = value;
    },
    get outerConeAngle(): number {
      return lightBufferView.outerConeAngle[0];
    },
    set outerConeAngle(value: number) {
      lightBufferView.outerConeAngle[0] = value;
    },
    get castShadow(): boolean {
      return !!lightBufferView.castShadow[0];
    },
    set castShadow(value: boolean) {
      lightBufferView.castShadow[0] = value ? 1 : 0;
    },
  };

  rendererModule.spotLights.push(remoteLight);

  return remoteLight;
}

export function createDirectionalLight(state: GameState, parentEid?: number) {
  const eid = addEntity(state.world);
  addTransformComponent(state.world, eid);

  addRemoteNodeComponent(state, eid, {
    light: createDirectionalLightResource(state),
  });

  if (parentEid !== undefined) {
    addChild(parentEid, eid);
  }

  return eid;
}
