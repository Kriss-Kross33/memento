import type { OnDeviceSemanticModel } from '@/models/intelligence';
import { SEMANTIC_MODEL_UNAVAILABLE } from '@/models/intelligence';

let installed: OnDeviceSemanticModel = SEMANTIC_MODEL_UNAVAILABLE;

/** Extension point for a future on-device model. Nothing is loaded in V2. */
export const getSemanticModel = (): OnDeviceSemanticModel => installed;

export const registerSemanticModel = (model: OnDeviceSemanticModel): void => {
  installed = model;
};
