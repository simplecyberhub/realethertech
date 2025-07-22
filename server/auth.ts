import { Request, Response, NextFunction } from "express";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { userLoginSchema } from "@shared/schema";
import { storage } from "./storage";

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
    interface SessionData {
      userId?: number;
    }
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256");
  hash.update(password + salt);
  return `${hash.digest("hex")}.${salt}`;
}

export async function comparePassword(storedPassword: string, providedPassword: string): Promise<boolean> {
  const [hashedPassword, salt] = storedPassword.split(".");
  
  const hash = createHash("sha256");
  hash.update(providedPassword + salt);
  const hashedProvidedPassword = hash.digest("hex");
  
  // Use timingSafeEqual to prevent timing attacks
  const storedBuffer = Buffer.from(hashedPassword, "hex");
  const providedBuffer = Buffer.from(hashedProvidedPassword, "hex");
  
  return storedBuffer.length === providedBuffer.length && 
         timingSafeEqual(storedBuffer, providedBuffer);
}

export function registerAuthRoutes(app: any) {
  // Middleware to check if user is authenticated
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.session && req.session.userId) {
      storage.getUser(req.session.userId)
        .then(user => {
          if (user) {
            req.user = user;
          }
          next();
        })
        .catch(err => {
          console.error("Error fetching user:", err);
          next();
        });
    } else {
      next();
    }
  });

  // Register a new user
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const userData = userLoginSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Hash password and create user
      const hashedPassword = await hashPassword(userData.password);
      const user = await storage.createUser({
        username: userData.username,
        password: hashedPassword,
      });
      
      // Set session
      req.session.userId = user.id;
      
      // Return user without password
      const { password, ...userWithoutPassword } = user;
      res.status(201).json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({ message: "Invalid user data" });
    }
  });

  // Login a user
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const userData = userLoginSchema.parse(req.body);
      
      // Find user by username
      const user = await storage.getUserByUsername(userData.username);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Verify password
      const passwordValid = await comparePassword(user.password, userData.password);
      if (!passwordValid) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Set session
      req.session.userId = user.id;
      
      // Return user without password
      const { password, ...userWithoutPassword } = user;
      res.status(200).json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Login error:", error);
      res.status(400).json({ message: "Invalid login data" });
    }
  });

  // Logout a user
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.status(500).json({ message: "Could not log out" });
      }
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  // Get current user
  app.get("/api/auth/user", (req: Request, res: Response) => {
    if (req.user) {
      const { password, ...userWithoutPassword } = req.user;
      res.status(200).json({ user: userWithoutPassword });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });
}

// Middleware to ensure a user is authenticated
export function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.user) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}