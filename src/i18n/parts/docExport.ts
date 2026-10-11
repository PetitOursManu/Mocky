/**
 * Translations for downloading a DOCUMENT screen (DocumentDownloadDialog):
 * PDF with fillable fields, .pptx for Google Slides / PowerPoint, PNG pages.
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
    'docExport.format.letter': 'US Letter portrait',
    'docExport.format.letter-landscape': 'US Letter paysage',
    'docExport.format.slides': 'présentation 16:9',
    'docExport.format.social-square': 'post carré 1:1',
    'docExport.format.social-portrait': 'post portrait 4:5',
    'docExport.format.social-story': 'story 9:16',
    'docExport.format.social-landscape': 'image paysage 1,91:1',
    'docExport.pdf.title': 'PDF',
    'docExport.pdf.help': 'Pour imprimer ou envoyer, tel qu’il est dessiné. Le texte reste sélectionnable.',
    'docExport.pdf.titleFields': 'PDF — champs à remplir',
    'docExport.pdf.helpFields':
      'Pour imprimer ou envoyer. Les champs du document se remplissent dans n’importe quel lecteur PDF, et le texte reste sélectionnable.',
    'docExport.pptx.title': 'PowerPoint / Google Slides (.pptx) — textes modifiables',
    'docExport.pptx.help':
      'Pour continuer à modifier : déposez le fichier sur Google Drive, puis « Ouvrir avec Google Slides » — chaque texte reste modifiable. S’ouvre aussi dans PowerPoint et Keynote.',
    'docExport.png.title': 'Images PNG',
    'docExport.png.help': 'Pour publier : une image par page, réunies dans un .zip s’il y en a plusieurs.',
    'docExport.frames.heading': 'Gabarit — cadres vides',
    'docExport.frames.intro':
      'Le document tel qu’il est dessiné, avec ses cadres vides, pour y mettre vos propres images dans un autre logiciel. Le texte y est une image : pour modifier les mots, prenez PowerPoint.',
    'docExport.frames-png.title': 'PNG transparent',
    'docExport.frames-png.help': 'Les cadres sont des trous transparents : glissez une photo dessous, dans n’importe quel logiciel.',
    'docExport.frames-svg.title': 'SVG — Figma, Illustrator, Inkscape',
    'docExport.frames-svg.help': 'Chaque cadre est un masque vectoriel nommé, rempli de gris : remplacez le gris par une image.',
    'docExport.frames-pdf.title': 'PDF — Canva, Illustrator, Affinity',
    'docExport.frames-pdf.help':
      'Chaque cadre est un tracé vectoriel qui découpe une image d’attente. Importé dans Canva, il devient un cadre où glisser une photo.',
    'docExport.frames-psd.title': 'PSD — Photoshop',
    'docExport.frames-psd.help':
      'Un calque pour la page, un calque par cadre. Placez une photo au-dessus d’un cadre, puis Alt + clic entre les deux : c’est un masque d’écrêtage.',
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
    'docExport.format.letter': 'US Letter portrait',
    'docExport.format.letter-landscape': 'US Letter landscape',
    'docExport.format.slides': '16:9 presentation',
    'docExport.format.social-square': 'square 1:1 post',
    'docExport.format.social-portrait': 'portrait 4:5 post',
    'docExport.format.social-story': '9:16 story',
    'docExport.format.social-landscape': '1.91:1 landscape image',
    'docExport.pdf.title': 'PDF',
    'docExport.pdf.help': 'To print or send, exactly as designed. The text stays selectable.',
    'docExport.pdf.titleFields': 'PDF — fillable fields',
    'docExport.pdf.helpFields':
      'To print or send. The document’s fields can be filled in any PDF reader, and the text stays selectable.',
    'docExport.pptx.title': 'PowerPoint / Google Slides (.pptx) — editable text',
    'docExport.pptx.help':
      'To keep editing: upload the file to Google Drive, then “Open with Google Slides” — every text stays editable. Also opens in PowerPoint and Keynote.',
    'docExport.png.title': 'PNG images',
    'docExport.png.help': 'To post: one image per page, bundled in a .zip when there are several.',
    'docExport.frames.heading': 'Template — empty frames',
    'docExport.frames.intro':
      'The document as designed, with its frames left empty, to put your own pictures in with another tool. Its text is part of the picture: to edit words, take PowerPoint.',
    'docExport.frames-png.title': 'Transparent PNG',
    'docExport.frames-png.help': 'The frames are transparent holes: slide a photo under the page, in any tool.',
    'docExport.frames-svg.title': 'SVG — Figma, Illustrator, Inkscape',
    'docExport.frames-svg.help': 'Each frame is a named vector mask filled with grey: replace the grey with a picture.',
    'docExport.frames-pdf.title': 'PDF — Canva, Illustrator, Affinity',
    'docExport.frames-pdf.help': 'Each frame is a vector path clipping a placeholder picture. Imported into Canva, it becomes a frame to drop a photo into.',
    'docExport.frames-psd.title': 'PSD — Photoshop',
    'docExport.frames-psd.help':
      'One layer for the page, one per frame. Place a photo above a frame, then Alt + click between the two: that is a clipping mask.',
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
    'docExport.notice.raster.pdf': 'Page {pages} could not be drawn: it is blank in the PDF, with only its fillable fields.',
    'docExport.notice.raster.pptx': 'Page {pages} could not be drawn: its background is blank, but its text stays editable.',
    'docExport.notice.raster.png': 'Page {pages} could not be drawn: the image is blank.',
  },
}
