/**
 * Packages all KMP Gradle files into a downloadable zip archive for the user.
 */

import JSZip from 'jszip';
import { KMP_SOURCE_FILES } from './kmpSources';

export async function generateKmpZip(): Promise<Blob> {
  const zip = new JSZip();

  // Add all KMP project files
  for (const file of KMP_SOURCE_FILES) {
    zip.file(file.path, file.content);
  }

  // Add root README explaining targets and building instructions
  zip.file(
    'README.md',
    `# OllO Smart Glasses KMP App

A Kotlin Multiplatform (KMP) + Compose Multiplatform flashcard manager for smart glasses over BLE.
Targets: Android, iOS, Windows/macOS/Linux Desktop.

## Requirements
- JDK 17 or higher
- Android Studio Ladybug / Koala or IntelliJ IDEA with KMP plugin
- Xcode 15+ for iOS compilation

## Running Targets
- **Windows / Desktop**: \`./gradlew :composeApp:run\`
- **Android**: Run \`:composeApp\` on an Android device or emulator
- **Run Unit Tests**: \`./gradlew :composeApp:allTests\`
`
  );

  return await zip.generateAsync({ type: 'blob' });
}
