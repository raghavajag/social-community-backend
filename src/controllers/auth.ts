import { NextFunction, Response, Request } from "express";
import prisma from "../config/prisma";
import { SocialTypes } from "../types/index";

import ErrorResponse from "../utils/errorResponse";
import passport from "passport";
import bcrypt from "bcrypt";
const CLIENT_URL = "localhost:3000";

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { email, name, password, firstName, lastName, role } = req.body;
  const doesExist = await prisma.user.findMany({
    where: {
      OR: [
        {
          email,
        },
        {
          name,
        },
      ],
    },
    select: {
      id: true,
    },
  });
  if (doesExist.length) {
    return next(new ErrorResponse("User name/email taken", 409, "register"))
  }
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const User = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      name,
      password: hashedPassword,
      role: role || "USER",
    },
  });
  return req.login({ id: User.id, role: User.role }, function (err: Error) {
    if (err) {
      return next(new ErrorResponse("Error while logging in", 400, "login"))
    }
    return res.json({ success: true });
  });
}
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    req.logout((err: Error) => {
      if (err) {
        return next(new ErrorResponse("Error while logging out", 400, "logout"))
      }
      return res.json({ success: true });
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  passport.authenticate(
    "local",
    function (
      err: Error,
      user: SocialTypes.UserData,
      info: { message: string }
    ) {
      if (err) {
        return next(err);
      }
      if (!user) {
        return next(new ErrorResponse(info.message, 404, "login"));
      }
      return req.login(user, function (err) {
        if (err) {
          return next(new ErrorResponse("Error while logging", 401, "login"));
        }
        return res.json({ success: true });
      });
    }
  )(req, res, next);
}

export async function google(_req: Request, _res: Response, _next: NextFunction) {
  return passport.authenticate("google", { scope: ["profile", "email"] });
}

export async function googleCallback(
  req: Request,
  res: Response,
  next: NextFunction
) {
  passport.authenticate(
    "google",
    async (
      error: Error,
      user: SocialTypes.UserData,
      info: { message: string }
    ) => {
      try {
        if (error) {
          return next(error.message);
        }
        if (!user) {
          res.status(401);
          res.send(`<h1>${info.message}</h1>`);
          return;
        }
        req.login(user, function (err) {
          if (err) {
            return next(err);
          }
          return res.redirect(CLIENT_URL);
        });
      } catch (error) {
        return next(new ErrorResponse("Error while logging", 401, "login"));
      }
    }
  )(req, res, next);
}

export async function loginFailed(
  _req: Request,
  _res: Response,
  next: NextFunction
) {
  return next(new ErrorResponse("Error while logging", 401, "login"));
}
export async function loginSuccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.user) {
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  }
  return next(new ErrorResponse("Error while logging", 401, "login"));
}
export async function me(req: Request, res: Response, next: NextFunction) {
  const User = await prisma.user.findUnique({
    where: {
      id: req.user!.id,
    },
  });
  if (!User) {
    return next(new ErrorResponse("User not found", 404, "me"));
  }
  return res.json({ data: User });
}
