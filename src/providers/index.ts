/**
 * Providers Module
 *
 * This module re-exports all provider-related types and the specifications registry.
 */

export {
  Provider,
  type ProviderFromGenAIArgs,
  type ProviderMessage,
  type ProviderMetadata,
  type ProviderSpecification,
  type ProviderSystem,
  type ProviderToGenAIArgs,
} from "$package/providers/provider";
export {
  getProviderSpecification,
  type ProviderSource,
  type ProviderTarget,
} from "$package/providers/specifications";
