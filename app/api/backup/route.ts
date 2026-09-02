import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const dbPath = path.join(process.cwd(), "data", "app-db.json");
    
    // Read current database
    const dbContent = await fs.readFile(dbPath, "utf-8");
    
    // Create backup with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.join(process.cwd(), "data", "backups");
    
    // Ensure backups directory exists
    await fs.mkdir(backupDir, { recursive: true });
    
    const backupPath = path.join(backupDir, `app-db.backup.${timestamp}.json`);
    
    // Write backup
    await fs.writeFile(backupPath, dbContent, "utf-8");
    
    // Keep only last 10 backups
    const files = await fs.readdir(backupDir);
    const backupFiles = files
      .filter((f) => f.startsWith("app-db.backup."))
      .sort()
      .reverse();
    
    if (backupFiles.length > 10) {
      for (let i = 10; i < backupFiles.length; i++) {
        await fs.unlink(path.join(backupDir, backupFiles[i]));
      }
    }
    
    return NextResponse.json({
      success: true,
      backupPath,
      timestamp,
      message: "Database backed up successfully",
      totalBackups: Math.min(backupFiles.length + 1, 10),
    });
  } catch (error) {
    console.error("Backup error:", error);
    return NextResponse.json(
      { error: "Failed to create backup" },
      { status: 500 }
    );
  }
}

// Get backup status
export async function GET() {
  try {
    const backupDir = path.join(process.cwd(), "data", "backups");
    
    try {
      const files = await fs.readdir(backupDir);
      const backupFiles = files
        .filter((f) => f.startsWith("app-db.backup."))
        .sort()
        .reverse();
      
      return NextResponse.json({
        success: true,
        totalBackups: backupFiles.length,
        lastBackup: backupFiles[0] || null,
        backups: backupFiles.slice(0, 5),
      });
    } catch {
      return NextResponse.json({
        success: true,
        totalBackups: 0,
        lastBackup: null,
        backups: [],
      });
    }
  } catch (error) {
    console.error("Backup status error:", error);
    return NextResponse.json(
      { error: "Failed to get backup status" },
      { status: 500 }
    );
  }
}
