# Build Resources

This directory contains resources needed for building the application installer.

## Icon Files

The application requires icon files for Windows builds:

### Required Files:

- **icon.ico** - Windows application icon (256x256 or multiple sizes)
  - Used for: Application executable, installer, uninstaller
  - Format: ICO file with multiple resolutions (16x16, 32x32, 48x48, 64x64, 128x128, 256x256)
  - Recommended: Use a tool like ImageMagick or online converters to create from PNG

### Creating Icons:

You can create icon files from PNG images using various tools:

1. **ImageMagick** (command line):
   ```bash
   convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
   ```

2. **Online converters**:
   - https://convertio.co/png-ico/
   - https://www.icoconverter.com/

3. **Design tools**:
   - Adobe Photoshop
   - GIMP (with ICO plugin)
   - Inkscape

### Icon Design Guidelines:

- Use simple, recognizable shapes
- Ensure visibility at small sizes (16x16)
- Use the Pomodoro timer theme (tomato, clock, etc.)
- Maintain consistency with app branding
- Test at different sizes and backgrounds

## Placeholder Icon

Currently, this directory contains a placeholder icon. Replace it with your actual application icon before building for production.
