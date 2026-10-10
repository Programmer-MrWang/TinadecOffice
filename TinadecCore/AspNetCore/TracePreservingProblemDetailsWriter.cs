using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;

namespace TinadecCore.AspNetCore;

/// <summary>
/// The framework writer stamps trace_id before customization. An upstream trace is
/// already the correlation identity of an explicit problem, so preserve it here.
/// Problems without a supplied trace continue through the framework writer.
/// </summary>
internal sealed class TracePreservingProblemDetailsWriter(
    IOptions<JsonOptions> jsonOptions,
    IOptions<ProblemDetailsOptions> problemOptions) : IProblemDetailsWriter
{
    private static readonly MediaTypeHeaderValue Json = new("application/json");
    private static readonly MediaTypeHeaderValue ProblemJson = new("application/problem+json");

    public bool CanWrite(ProblemDetailsContext context)
    {
        if (!context.ProblemDetails.Extensions.ContainsKey("trace_id")) return false;
        var accept = context.HttpContext.Request.GetTypedHeaders().Accept;
        return accept is null || accept.Count == 0 || accept.Any(type =>
            type.IsSubsetOf(Json) || type.IsSubsetOf(ProblemJson) ||
            Json.IsSubsetOf(type) || ProblemJson.IsSubsetOf(type));
    }

    public ValueTask WriteAsync(ProblemDetailsContext context)
    {
        // Results.Problem applies RFC defaults before consulting the writer. For a
        // direct service call, the existing Core customization fills its code/type.
        context.ProblemDetails.Status ??= context.HttpContext.Response.StatusCode;
        problemOptions.Value.CustomizeProblemDetails?.Invoke(context);
        return new ValueTask(context.HttpContext.Response.WriteAsJsonAsync(
            context.ProblemDetails, context.ProblemDetails.GetType(),
            jsonOptions.Value.SerializerOptions, contentType: "application/problem+json"));
    }
}
