Deno.serve(async (req) => {
  // Platform's verify_jwt = true already validated the JWT.
  // Accept any valid JWT and run sync.
  return runSync(false)
})