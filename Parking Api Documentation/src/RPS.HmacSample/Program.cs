using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using RPS.HmacSample;

var environment =
    Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
    ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
    ?? "Development";

var config = new ConfigurationBuilder()
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: false)
    .AddJsonFile($"appsettings.{environment}.json", optional: true, reloadOnChange: false)
    .AddEnvironmentVariables()
    .Build();

var api = config.GetSection("ParkingApi");
var baseUrl = api["BaseUrl"]?.TrimEnd('/')
    ?? throw new InvalidOperationException("ParkingApi:BaseUrl is required.");
var clientId = api["ClientId"]
    ?? throw new InvalidOperationException("ParkingApi:ClientId is required.");
var secretB64 = api["SecretBase64"]
    ?? throw new InvalidOperationException("ParkingApi:SecretBase64 is required.");
var outlet = api["Outlet"] ?? "";
var terminal = api["Terminal"] ?? "";

if (string.IsNullOrWhiteSpace(secretB64))
{
    throw new InvalidOperationException(
        "ParkingApi:SecretBase64 is empty. For local dev set DOTNET_ENVIRONMENT=Development " +
        "or add SecretBase64 to appsettings. For production use environment variables / user secrets.");
}

// Reject non-canonical Base64 so a "rotated" secret that only differs in
// the discarded trailing padding bits ("...MDA=" vs "...MDB=" decode to
// the same bytes) doesn't silently keep the old key. See ParkingHmacSigner
// for the full rationale.
ParkingHmacSigner.ValidateCanonicalSecret("ParkingApi:SecretBase64", secretB64);

Console.WriteLine($"RPS HMAC sample → {baseUrl} (clientId={clientId}, env={environment})");

using var http = new HttpClient();

// --- GET /api/parkingInit (signed query string) ---
var query = string.Join('&',
    $"application={Uri.EscapeDataString("Parking")}",
    $"outlet={Uri.EscapeDataString(outlet)}",
    $"terminal={Uri.EscapeDataString(terminal)}",
    $"versionName={Uri.EscapeDataString("RpsHmacSample")}",
    $"versionNumber={Uri.EscapeDataString("1.0.0")}");
var getPathAndQuery = $"/api/parkingInit?{query}";
var getAuth = ParkingHmacSigner.CreateAuthorizationHeader(
    clientId, secretB64, HttpMethod.Get.Method, getPathAndQuery, ReadOnlySpan<byte>.Empty);

using (var req = new HttpRequestMessage(HttpMethod.Get, new Uri($"{baseUrl}{getPathAndQuery}")))
{
    req.Headers.TryAddWithoutValidation("Authorization", getAuth);
    using var resp = await http.SendAsync(req);
    var body = await resp.Content.ReadAsStringAsync();
    Console.WriteLine();
    Console.WriteLine($"GET  {getPathAndQuery} → {(int)resp.StatusCode} {resp.ReasonPhrase}");
    PrintBody(body);
}

// --- POST /api/parkingInit (signed JSON body) ---
var postPathAndQuery = "/api/parkingInit";
var json = JsonSerializer.Serialize(new
{
    application = "Parking",
    outlet,
    terminal,
    versionName = "RpsHmacSample",
    versionNumber = "1.0.0"
});
var jsonBytes = Encoding.UTF8.GetBytes(json);
var postAuth = ParkingHmacSigner.CreateAuthorizationHeader(
    clientId, secretB64, HttpMethod.Post.Method, postPathAndQuery, jsonBytes);

using (var req = new HttpRequestMessage(HttpMethod.Post, new Uri($"{baseUrl}{postPathAndQuery}")))
{
    req.Headers.TryAddWithoutValidation("Authorization", postAuth);
    req.Content = new ByteArrayContent(jsonBytes);
    req.Content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json")
    {
        CharSet = "utf-8"
    };

    using var resp = await http.SendAsync(req);
    var body = await resp.Content.ReadAsStringAsync();
    Console.WriteLine();
    Console.WriteLine($"POST {postPathAndQuery} → {(int)resp.StatusCode} {resp.ReasonPhrase}");
    PrintBody(body);
}

return;

static void PrintBody(string body)
{
    if (body.Length <= 800)
        Console.WriteLine(body);
    else
        Console.WriteLine(body.AsSpan(0, 800).ToString() + "…");
}
