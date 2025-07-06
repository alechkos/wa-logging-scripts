// Credit: @jlucaso1
// https://gist.github.com/jlucaso1/8cd53b7c1d9502005889d6699869c469

// --- Initialization ---
// Ensure the original functions are stored so we can call them
if (!window.originalDecodeStanza) {
  window.originalDecodeStanza = require("WAWap").decodeStanza;
  window.originalEncodeStanza = require("WAWap").encodeStanza;
}

/**
 * Recursively walks through an object or array and decodes any Uint8Array
 * placeholders it finds into JSON objects.
 * @param data The object or array to traverse.
 * @returns The traversed data with all possible buffers decoded.
 */
function recursiveDecode(data) {
  // If it's not an object (e.g., string, number) or is null, we can't traverse it.
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  // If it's an array, traverse each item in the array.
  if (Array.isArray(data)) {
    return data.map(item => recursiveDecode(item));
  }

  // Check if the object is our placeholder for a Uint8Array.
  // We identify it by checking if all its keys are numeric strings.
  const keys = Object.keys(data);
  const isBufferPlaceholder = keys.length > 0 && keys.every(k => !isNaN(parseInt(k, 10)));

  if (isBufferPlaceholder) {
    try {
      // Reconstruct the Uint8Array from the object's values.
      const buffer = new Uint8Array(Object.values(data));
      // Decode the buffer into a string, then parse it as JSON.
      const jsonString = new TextDecoder().decode(buffer);
      const parsedData = JSON.parse(jsonString);

      // IMPORTANT: Recurse on the newly parsed data in case it has more buffers inside.
      return recursiveDecode(parsedData);
    } catch (e) {
      // If it's not valid JSON (e.g., it's a real binary buffer for an image),
      // we'll just return the original placeholder and not crash.
      return data;
    }
  }

  // If it's a regular object, traverse each of its values.
  const newData = {};
  for (const key of keys) {
    newData[key] = recursiveDecode(data[key]);
  }
  return newData;
}


// --- Monkey-patch the DECODE function for Inbound Messages ---
require("WAWap").decodeStanza = async (e, t) => {
  const result = await window.originalDecodeStanza(e, t);

  const title = `[INFO] Inbound, tag: ${result.tag}, type: ${result.attrs?.type}`;
  console.groupCollapsed(title);

  try {
    // Create a deep copy for safe logging and manipulation.
    const loggableResult = JSON.parse(JSON.stringify(result));
    
    // Process the entire loggable object recursively.
    const fullyDecodedResult = recursiveDecode(loggableResult);
    
    // Log the final, fully readable JSON string.
    console.log(JSON.stringify(fullyDecodedResult, null, 2));

  } catch (logError) {
    console.error("Error in custom logger:", logError);
    console.log("Original Stanza:", result); // Fallback to logging original on error
  }

  console.groupEnd();

  // IMPORTANT: Return the original, untouched stanza to the application.
  return result;
}

// --- Monkey-patch the ENCODE function for Outbound Messages ---
require("WAWap").encodeStanza = (...args) => {
  const stanza = args[0];
  const result = window.originalEncodeStanza(...args);

  if (stanza) {
    const title = `[INFO] Outbound, tag: ${stanza.tag}, type: ${stanza.attrs?.type}`;
    const replacer = (key, value) => (value instanceof Uint8Array ? `Uint8Array(size=${value.length})` : value);
    
    console.groupCollapsed(title);
    console.log(JSON.stringify(stanza, replacer, 2));
    console.groupEnd();
  }

  return result;
}

console.log("WhatsApp Web Recursive logger script loaded and patched successfully.");
