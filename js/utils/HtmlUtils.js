/**
 * Decodifica entidades HTML en un texto.
 * Convierte cosas como &oacute; a ó, &ntilde; a ñ, etc.
 * 
 * @param {string} html Texto con entidades HTML que necesita ser decodificado
 * @return {string} Texto decodificado con caracteres Unicode
 */
function decodeHtmlEntities(html) {
  if (!html) return '';
  
  // Crear un elemento temporal para la decodificación
  const textArea = document.createElement('textarea');
  textArea.innerHTML = html;
  
  // El valor del textarea tendrá el texto decodificado
  return textArea.value;
}

export { decodeHtmlEntities };
