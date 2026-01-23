/**
 * Input Types
 *
 * Contains the input types for the translator.
 */

/** Messages can be a string or an array of provider messages. */
export type InputMessages = string | object[];

/** System can be a string, an object, or an array of system parts. */
export type InputSystem = string | object | object[];
