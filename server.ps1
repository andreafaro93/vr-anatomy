# Server HTTP locale ultra-leggero nativo in PowerShell (Nessuna dipendenza esterna)
$port = 8080
$path = $PSScriptRoot

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
$listener.Start()

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   LABORATORIO ANATOMICO 3D & VR ATTIVO" -ForegroundColor Green
Write-Host "   URL: http://localhost:$port/" -ForegroundColor Yellow
Write-Host "   Premi Ctrl+C per fermare il server" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

# Apri il browser predefinito
try {
    Start-Process "http://localhost:$port/"
} catch {
    Write-Host "Apri manualmente nel browser: http://localhost:$port/" -ForegroundColor Yellow
}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".glb"  = "model/gltf-binary"
    ".gltf" = "model/gltf+json"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".svg"  = "image/svg+xml"
}

try {
    while ($listener.Server.IsBound) {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        $reader = [System.IO.StreamReader]::new($stream)
        
        $requestLine = $reader.ReadLine()
        if ([string]::IsNullOrEmpty($requestLine)) {
            $client.Close()
            continue
        }
        
        $tokens = $requestLine.Split(" ")
        $url = $tokens[1]
        
        # Gestione path con decodifica URL per spazi e caratteri speciali
        $cleanUrl = $url.Split("?")[0]
        $cleanUrl = [System.Uri]::UnescapeDataString($cleanUrl)
        if ($cleanUrl -eq "/" -or [string]::IsNullOrEmpty($cleanUrl)) {
            $cleanUrl = "/index.html"
        }
        
        # Supporto alias cartella /gib/ -> /glb/
        if ($cleanUrl.StartsWith("/gib/")) {
            $cleanUrl = "/glb/" + $cleanUrl.Substring(5)
        }
        
        $filePath = [System.IO.Path]::Combine($path, $cleanUrl.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar))
        
        if ([System.IO.File]::Exists($filePath)) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            
            $header = "HTTP/1.1 200 OK`r`n" +
                      "Content-Type: $mime`r`n" +
                      "Content-Length: $($bytes.Length)`r`n" +
                      "Access-Control-Allow-Origin: *`r`n" +
                      "Connection: close`r`n`r`n"
            $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($header)
            
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            $stream.Write($bytes, 0, $bytes.Length)
        } else {
            $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $header = "HTTP/1.1 404 Not Found`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
            $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($header)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            $stream.Write($body, 0, $body.Length)
        }
        
        $stream.Flush()
        $client.Close()
    }
} finally {
    $listener.Stop()
}
