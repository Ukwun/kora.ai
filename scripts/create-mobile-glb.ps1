param(
  [string]$InputPath = "public/models/Korar1.glb",
  [string]$OutputPath = "public/models/Korar1-mobile.glb",
  [int]$MaxTextureSize = 1024,
  [int]$JpegQuality = 72
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$source = [IO.File]::ReadAllBytes((Resolve-Path $InputPath))
$jsonLength = [BitConverter]::ToUInt32($source, 12)
$jsonText = [Text.Encoding]::UTF8.GetString($source, 20, $jsonLength).Trim([char]0x20, [char]0)
$document = $jsonText | ConvertFrom-Json
$binChunkHeader = 12 + 8 + $jsonLength
$binStart = $binChunkHeader + 8
$binLength = [BitConverter]::ToUInt32($source, $binChunkHeader)
$bin = [byte[]]::new($binLength)
[Array]::Copy($source, $binStart, $bin, 0, $binLength)

$imageBufferViews = @{}
for ($imageIndex = 0; $imageIndex -lt @($document.images).Count; $imageIndex++) {
  $image = @($document.images)[$imageIndex]
  if ($null -eq $image.bufferView) { continue }
  $imageBufferViews[[int]$image.bufferView] = $image.mimeType
}

$segments = @()
for ($viewIndex = 0; $viewIndex -lt @($document.bufferViews).Count; $viewIndex++) {
  $view = @($document.bufferViews)[$viewIndex]
  $offset = if ($null -eq $view.byteOffset) { 0 } else { [int]$view.byteOffset }
  $length = [int]$view.byteLength
  $segment = [byte[]]::new($length)
  [Array]::Copy($bin, $offset, $segment, 0, $length)
  $mime = $imageBufferViews[$viewIndex]
  if ($null -ne $mime) {
    $inputStream = [IO.MemoryStream]::new($segment)
    $image = [Drawing.Image]::FromStream($inputStream)
    $scale = [Math]::Min(1.0, $MaxTextureSize / [double][Math]::Max($image.Width, $image.Height))
    $width = [Math]::Max(1, [int][Math]::Round($image.Width * $scale))
    $height = [Math]::Max(1, [int][Math]::Round($image.Height * $scale))
    $bitmap = [Drawing.Bitmap]::new($width, $height)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.DrawImage($image, 0, 0, $width, $height)
    $graphics.Dispose()
    $outputStream = [IO.MemoryStream]::new()
    if ($mime -eq "image/png") {
      $bitmap.Save($outputStream, [Drawing.Imaging.ImageFormat]::Png)
    } else {
      $codec = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq "image/jpeg"
      $parameters = [Drawing.Imaging.EncoderParameters]::new(1)
      $parameters.Param[0] = [Drawing.Imaging.EncoderParameter]::new([Drawing.Imaging.Encoder]::Quality, [long]$JpegQuality)
      $bitmap.Save($outputStream, $codec, $parameters)
      $parameters.Dispose()
    }
    $bitmap.Dispose(); $image.Dispose(); $inputStream.Dispose()
    $segment = $outputStream.ToArray(); $outputStream.Dispose()
  }
  $segments += [pscustomobject]@{ Index = $viewIndex; Offset = $offset; Data = $segment }
}

$segments = $segments | Sort-Object Offset
$newBinStream = [IO.MemoryStream]::new()
foreach ($segment in $segments) {
  while (($newBinStream.Length % 4) -ne 0) { $newBinStream.WriteByte(0) }
  $view = @($document.bufferViews)[$segment.Index]
  $view.byteOffset = [int]$newBinStream.Position
  $view.byteLength = $segment.Data.Length
  $newBinStream.Write($segment.Data, 0, $segment.Data.Length)
}
while (($newBinStream.Length % 4) -ne 0) { $newBinStream.WriteByte(0) }
$newBin = $newBinStream.ToArray(); $newBinStream.Dispose()
$document.buffers[0].byteLength = $newBin.Length
$json = [Text.Encoding]::UTF8.GetBytes(($document | ConvertTo-Json -Depth 100 -Compress))
while (($json.Length % 4) -ne 0) { $json += [byte][char]0x20 }

$output = [IO.MemoryStream]::new()
$writer = [IO.BinaryWriter]::new($output)
$writer.Write([uint32]0x46546C67); $writer.Write([uint32]2); $writer.Write([uint32](12 + 8 + $json.Length + 8 + $newBin.Length))
$writer.Write([uint32]$json.Length); $writer.Write([uint32]0x4E4F534A); $writer.Write([byte[]]$json, 0, $json.Length)
$writer.Write([uint32]$newBin.Length); $writer.Write([uint32]0x004E4942); $writer.Write([byte[]]$newBin, 0, $newBin.Length)
$writer.Flush(); [IO.File]::WriteAllBytes($OutputPath, $output.ToArray()); $writer.Dispose(); $output.Dispose()
Write-Output "Created $OutputPath ($([Math]::Round((Get-Item $OutputPath).Length / 1MB, 2)) MB)"
