
# Load System.Drawing assembly
Add-Type -AssemblyName System.Drawing

function Resize-Image {
    param (
        [string]$InputPath,
        [string]$OutputPath,
        [int]$Width,
        [int]$Height
    )

    if (-not (Test-Path $InputPath)) {
        Write-Host "Error: $InputPath not found."
        return
    }

    try {
        # Load the image ensuring we don't lock the file if Input == Output
        $fileStream = [System.IO.File]::OpenRead($InputPath)
        $image = [System.Drawing.Image]::FromStream($fileStream)
        
        $bitmap = new-object System.Drawing.Bitmap $Width, $Height
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.DrawImage($image, 0, 0, $Width, $Height)
        
        # Dispose of the original image and stream to release file lock
        $graphics.Dispose()
        $image.Dispose()
        $fileStream.Close()
        $fileStream.Dispose()

        # Now we can save to the file
        $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $bitmap.Dispose()
        
        Write-Host "Resized $InputPath to ${Width}x${Height} and saved to $OutputPath"
    }
    catch {
        Write-Host "Failed to resize $InputPath : $_"
    }
}

$baseDir = "e:\InsightEd-Mobile-PWA\public"
$appIcon = Join-Path $baseDir "InsightED app.png"
$appleIcon = Join-Path $baseDir "apple-touch-icon.png"

# Resize InsightED app.png to 512x512
Resize-Image -InputPath $appIcon -OutputPath $appIcon -Width 512 -Height 512

# Resize apple-touch-icon.png to 180x180
Resize-Image -InputPath $appleIcon -OutputPath $appleIcon -Width 180 -Height 180
