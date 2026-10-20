/**
 * Translations for downloading a DOCUMENT screen (DocumentDownloadDialog):
 * PDF with fillable fields, .pptx for Canva / Google Slides / PowerPoint, PNG
 * pages, and the page in layers as a PSD and an SVG.
 *
 * Its own area so the export's strings never touch the files the page kit's
 * strings live in. Same rules as every area: identical key sets, keys under
 * `docExport.`.
 */
export const docExport = {
  fr: {
    'docExport.title': 'Télécharger le document',
    'docExport.intro': 'Format {format}. Le fichier se télécharge directement, sans passer par l’impression.',
    'docExport.format.a4': 'A4 portrait',
    'docExport.format.a4-landscape': 'A4 paysage',
    'docExport.format.a3': 'A3 portrait',
    'docExport.format.a3-landscape': 'A3 paysage',
    'docExport.format.a2': 'A2 portrait',
    'docExport.format.a5': 'A5 portrait',
    'docExport.format.a5-landscape': 'A5 paysage',
    'docExport.format.a6': 'A6',
    'docExport.format.dl': 'DL (99 × 210 mm)',
    'docExport.format.square-21': 'Carré 21 cm',
    'docExport.format.letter': 'US Letter portrait',
    'docExport.format.letter-landscape': 'US Letter paysage',
    'docExport.format.slides': 'présentation 16:9',
    'docExport.format.social-square': 'post carré 1:1',
    'docExport.format.social-portrait': 'post portrait 4:5',
    'docExport.format.social-story': 'story 9:16',
    'docExport.format.social-landscape': 'image paysage 1,91:1',
    'docExport.pdf.title': 'PDF',
    'docExport.pdf.help': 'Pour imprimer ou envoyer, tel qu’il est dessiné, en haute définition. Le texte reste sélectionnable.',
    'docExport.pdf.titleFields': 'PDF — champs à remplir',
    'docExport.pdf.helpFields':
      'Pour imprimer ou envoyer. Les champs du document se remplissent dans n’importe quel lecteur PDF, et le texte reste sélectionnable.',
    'docExport.pptx.title': 'PowerPoint / Google Slides / Canva (.pptx) — textes et cadres modifiables',
    'docExport.pptx.help':
      'Pour continuer à modifier : importez le fichier dans Canva, ou déposez-le sur Google Drive puis « Ouvrir avec Google Slides ». Chaque texte reste modifiable, et chaque image dans une forme est un cadre où glisser une autre photo. S’ouvre aussi dans PowerPoint et Keynote.',
    'docExport.png.title': 'Images PNG',
    'docExport.png.help': 'Pour publier : une image par page, réunies dans un .zip s’il y en a plusieurs.',
    'docExport.psd.title': 'PSD — Photoshop, Photopea',
    'docExport.psd.help':
      'Un calque pour la page, un calque par image dans une forme. Placez une photo au-dessus, puis Alt + clic entre les deux : elle prend la même forme. Le texte fait partie de la page.',
    'docExport.svg.title': 'SVG — Figma, Illustrator, Inkscape',
    'docExport.svg.help': 'Chaque image dans une forme est un masque nommé : remplacez l’image qu’il contient. Le texte fait partie de la page.',
    'docExport.progress.render': 'Mise en page du document…',
    'docExport.progress.page': 'Page {page} sur {total}…',
    'docExport.progress.build': 'Assemblage du fichier…',
    'docExport.progress.label': 'Avancement de l’export',
    'docExport.cancel': 'Annuler',
    'docExport.cancelled': 'Export annulé.',
    'docExport.done': '« {file} » est prêt.',
    'docExport.saveAgain': 'Enregistrer « {file} »',
    'docExport.saveAgainHint': 'Si le téléchargement n’a pas démarré tout seul.',
    'docExport.error': 'L’export n’a pas abouti. Réessayez ; si le problème persiste, régénérez le document.',
    'docExport.empty': 'Ce document est vide : il n’y a rien à exporter.',
    'docExport.notice.noPages':
      'Ce document n’a pas de pages délimitées : il a été exporté en une seule page, coupée au format.',
    'docExport.notice.overflow': 'Du contenu dépasse du format et a été coupé (page {pages}).',
    'docExport.notice.measure': 'Le texte n’a pas pu être relevé (page {pages}) : exportée en image seule.',
    'docExport.notice.tilted':
      'Le texte incliné ou agrandi (page {pages}) reste dans l’image de fond : il n’est pas modifiable.',
    'docExport.notice.fallback':
      'Page {pages} dessinée par le moteur de secours de ce navigateur : flous, masques et certains effets peuvent manquer.',
    'docExport.notice.assets': 'Une image ou une police n’a pas pu être intégrée (page {pages}).',
    'docExport.notice.external':
      'Des images chargées depuis un autre site ({hosts}) manquent (page {pages}) : un export n’emporte que les images de Mocky. Ajoutez-les à la bibliothèque, placez-les dans le document, puis exportez à nouveau.',
    'docExport.notice.raster.pdf':
      'La page {pages} n’a pas pu être dessinée : elle est blanche dans le PDF, seuls ses champs à remplir y sont.',
    'docExport.notice.raster.pptx':
      'La page {pages} n’a pas pu être dessinée : son fond est blanc, mais ses textes restent modifiables.',
    'docExport.notice.raster.png': 'La page {pages} n’a pas pu être dessinée : l’image est blanche.',
  },
  en: {
    'docExport.title': 'Download the document',
    'docExport.intro': '{format}. The file downloads directly — no print dialog.',
    'docExport.format.a4': 'A4 portrait',
    'docExport.format.a4-landscape': 'A4 landscape',
    'docExport.format.a3': 'A3 portrait',
    'docExport.format.a3-landscape': 'A3 landscape',
    'docExport.format.a2': 'A2 portrait',
    'docExport.format.a5': 'A5 portrait',
    'docExport.format.a5-landscape': 'A5 landscape',
    'docExport.format.a6': 'A6',
    'docExport.format.dl': 'DL (99 × 210 mm)',
    'docExport.format.square-21': 'Square 21 cm',
    'docExport.format.letter': 'US Letter portrait',
    'docExport.format.letter-landscape': 'US Letter landscape',
    'docExport.format.slides': '16:9 presentation',
    'docExport.format.social-square': 'square 1:1 post',
    'docExport.format.social-portrait': 'portrait 4:5 post',
    'docExport.format.social-story': '9:16 story',
    'docExport.format.social-landscape': '1.91:1 landscape image',
    'docExport.pdf.title': 'PDF',
    'docExport.pdf.help': 'To print or send, exactly as designed, in high definition. The text stays selectable.',
    'docExport.pdf.titleFields': 'PDF — fillable fields',
    'docExport.pdf.helpFields':
      'To print or send. The document’s fields can be filled in any PDF reader, and the text stays selectable.',
    'docExport.pptx.title': 'PowerPoint / Google Slides / Canva (.pptx) — editable text and frames',
    'docExport.pptx.help':
      'To keep editing: import the file into Canva, or upload it to Google Drive and choose “Open with Google Slides”. Every text stays editable, and every picture in a shape is a frame to drop another photo into. Also opens in PowerPoint and Keynote.',
    'docExport.png.title': 'PNG images',
    'docExport.png.help': 'To post: one image per page, bundled in a .zip when there are several.',
    'docExport.psd.title': 'PSD — Photoshop, Photopea',
    'docExport.psd.help':
      'One layer for the page, one per picture in a shape. Place a photo above one and Alt + click between the two: it takes the same shape. The text is part of the page.',
    'docExport.svg.title': 'SVG — Figma, Illustrator, Inkscape',
    'docExport.svg.help': 'Every picture in a shape is a named mask: replace the picture inside it. The text is part of the page.',
    'docExport.progress.render': 'Laying out the document…',
    'docExport.progress.page': 'Page {page} of {total}…',
    'docExport.progress.build': 'Putting the file together…',
    'docExport.progress.label': 'Export progress',
    'docExport.cancel': 'Cancel',
    'docExport.cancelled': 'Export cancelled.',
    'docExport.done': '“{file}” is ready.',
    'docExport.saveAgain': 'Save “{file}”',
    'docExport.saveAgainHint': 'If the download did not start on its own.',
    'docExport.error': 'The export did not complete. Try again; if it keeps failing, regenerate the document.',
    'docExport.empty': 'This document is empty: there is nothing to export.',
    'docExport.notice.noPages':
      'This document has no page boxes: it was exported as a single page, cut at the format’s size.',
    'docExport.notice.overflow': 'Some content runs past the page and was cut off (page {pages}).',
    'docExport.notice.measure': 'The text could not be read (page {pages}): exported as an image only.',
    'docExport.notice.tilted': 'Rotated or scaled text (page {pages}) stays in the background picture: it cannot be edited.',
    'docExport.notice.fallback':
      'Page {pages} was drawn by this browser’s fallback renderer: blurs, masks and some effects may be missing.',
    'docExport.notice.assets': 'A picture or a font could not be embedded (page {pages}).',
    'docExport.notice.external':
      'Pictures loaded from another site ({hosts}) are missing (page {pages}): an export only carries Mocky’s own pictures. Add them to the library, put them in the document, then export again.',
    'docExport.notice.raster.pdf': 'Page {pages} could not be drawn: it is blank in the PDF, with only its fillable fields.',
    'docExport.notice.raster.pptx': 'Page {pages} could not be drawn: its background is blank, but its text stays editable.',
    'docExport.notice.raster.png': 'Page {pages} could not be drawn: the image is blank.',
  },
}
