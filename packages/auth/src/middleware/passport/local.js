const jwt = require("jsonwebtoken")
const { UserStatus } = require("../../constants")
const { compare } = require("../../hashing")
const env = require("../../environment")
const { getGlobalUserByEmail } = require("../../utils")
const { newid } = require("../../hashing")
const { createASession } = require("../../security/sessions")

const INVALID_ERR = "Invalid Credentials"

exports.options = {
  passReqToCallback: true,
}

/**
 * Passport Local Authentication Middleware.
 * @param {*} ctx the request structure
 * @param {*} email username to login with
 * @param {*} password plain text password to log in with
 * @param {*} done callback from passport to return user information and errors
 * @returns The authenticated user, or errors if they occur
 */
exports.authenticate = async function (ctx, email, password, done) {
  if (!email) return done(null, false, "Email Required.")
  if (!password) return done(null, false, "Password Required.")
  const params = ctx.params || {}
  const query = ctx.query || {}

  // use the request to find the tenantId
  const tenantId = params.tenantId || query.tenantId
  const dbUser = await getGlobalUserByEmail(email, tenantId)
  if (dbUser == null) {
    return done(null, false, { message: "User not found" })
  }

  // check that the user is currently inactive, if this is the case throw invalid
  if (dbUser.status === UserStatus.INACTIVE) {
    return done(null, false, { message: INVALID_ERR })
  }

  // authenticate
  if (await compare(password, dbUser.password)) {
    const sessionId = newid()
    const tenantId = dbUser.tenantId
    await createASession(dbUser._id, { sessionId, tenantId })

    dbUser.token = jwt.sign(
      {
        userId: dbUser._id,
        sessionId,
        tenantId,
      },
      env.JWT_SECRET
    )
    // Remove users password in payload
    delete dbUser.password

    return done(null, dbUser)
  } else {
    done(new Error(INVALID_ERR), false)
  }
}
