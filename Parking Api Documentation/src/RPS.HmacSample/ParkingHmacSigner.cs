using System.Net;
using System.Security.Cryptography;
using System.Text;

namespace RPS.HmacSample;

/// <summary>
/// Builds the <c>Authorization: hmacauth …</c> header exactly like
/// <c>RPS.Api.Authentication.HmacAuthenticationHandler</c>.
/// </summary>
internal static class ParkingHmacSigner
{
    /// <summary>
    /// Creates the full Authorization header value (without the "Authorization:" prefix).
    /// </summary>
    /// <param name="pathAndQuery">Path starting with / plus optional query, e.g. <c>/api/parkingInit?a=1</c>.</param>
    /// <param name="body">Raw body bytes; use empty for GET.</param>
    public static string CreateAuthorizationHeader(
        string clientId,
        string secretBase64,
        string method,
        string pathAndQuery,
        ReadOnlySpan<byte> body)
    {
        var keyBytes = Convert.FromBase64String(secretBase64);
        var bodyHash = Convert.ToBase64String(SHA256.HashData(body));

        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        var nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();

        var encodedPath = WebUtility.UrlEncode(pathAndQuery).ToLowerInvariant();
        var signatureBase = clientId + method.ToUpperInvariant() + encodedPath + timestamp + nonce + bodyHash;

        var signature = Convert.ToBase64String(
            HMACSHA256.HashData(keyBytes, Encoding.UTF8.GetBytes(signatureBase)));

        return $"hmacauth {clientId}:{signature}:{nonce}:{timestamp}";
    }

    /// <summary>
    /// Validates that a configured HMAC secret is in canonical Base64 form.
    /// Throws <see cref="InvalidOperationException"/> if the value is empty,
    /// not valid Base64, or non-canonical (i.e. round-tripping through
    /// <see cref="Convert.FromBase64String(string)"/> +
    /// <see cref="Convert.ToBase64String(byte[])"/> yields a different string).
    /// </summary>
    /// <remarks>
    /// Padded Base64 is not a one-to-one encoding: "MDA=" and "MDB=" both
    /// decode to the same two bytes (0x30 0x30) because the trailing data
    /// character carries bits the decoder discards. This means tweaking a
    /// trailing character of the configured secret produces a different-
    /// looking string that decodes to the SAME key — making the "rotation"
    /// a silent no-op. We fail fast at startup so the operator notices.
    /// The matching server-side check lives in
    /// <c>RPS.Api.Authentication.HmacSecretValidator</c>; the logic is kept
    /// duplicated here so the sample stays a self-contained reference
    /// without taking a build dependency on the API project.
    /// </remarks>
    /// <param name="label">
    /// Configuration path for the diagnostic message, e.g. <c>"ParkingApi:SecretBase64"</c>.
    /// </param>
    public static void ValidateCanonicalSecret(string label, string base64)
    {
        if (string.IsNullOrEmpty(base64))
        {
            throw new InvalidOperationException($"{label}: HMAC secret is empty.");
        }

        byte[] bytes;
        try
        {
            bytes = Convert.FromBase64String(base64);
        }
        catch (FormatException ex)
        {
            throw new InvalidOperationException(
                $"{label}: value is not valid Base64 ({ex.Message}).", ex);
        }

        var canonical = Convert.ToBase64String(bytes);
        if (!string.Equals(canonical, base64, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                $"{label}: configured Base64 secret is not canonical. " +
                $"Decoded value re-encodes to '{canonical}'. " +
                "Two different Base64 strings can decode to the same key bytes because of " +
                "padding, so 'rotating' by changing a trailing character is a silent no-op. " +
                "Use the canonical form above, or pick a genuinely different secret if you " +
                "intended to rotate.");
        }
    }
}
