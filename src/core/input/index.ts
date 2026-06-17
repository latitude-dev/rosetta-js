/**
 * Input Types
 *
 * Contains the input types for the translator.
 */

/** Messages can be a string, a single, or an array of provider messages. */
export type InputMessages = string | object | object[];

/** System can be a string, a single, or an array of system parts. */
export type InputSystem = string | object | object[];
