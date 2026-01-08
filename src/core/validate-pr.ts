import { validateSchema } from './schema-checker.js';
import { spawn } from 'child_process';

async function getChangedRecipeFiles(baseBranch: string = 'origin/main'): Promise<string[]> {
  return new Promise((resolve, reject) => {
    // Diff against the base branch to find changed files
    // --name-only: show only filenames
    // --diff-filter=ACM: Added, Copied, Modified (exclude Deleted)
    const git = spawn('git', ['diff', '--name-only', '--diff-filter=ACM', baseBranch, 'HEAD']);

    let output = '';
    let error = '';

    git.stdout.on('data', (data) => {
      output += data.toString();
    });

    git.stderr.on('data', (data) => {
      error += data.toString();
    });

    git.on('close', (code) => {
      if (code !== 0) {
        // Fallback: If origin/main doesn't exist (e.g., shallow clone or new repo),
        // validation might fail. We should ideally log this but for now reject.
        reject(new Error(`Git exited with code ${code}: ${error}`));
        return;
      }

      const files = output.split('\n')
        .map(s => s.trim())
        .filter(file => file.startsWith('recipies/') && file.endsWith('.json') && file !== '');

      resolve(files);
    });
  });
}

async function main() {
  try {
    // In CI, we assume 'origin/main' is the target.
    // You might want to make this dynamic based on env vars like CIRCLE_BRANCH
    const changedFiles = await getChangedRecipeFiles();

    if (changedFiles.length === 0) {
      console.log('No modified recipe files found compared to main.');
      process.exit(0);
    }

    console.log(`Found ${changedFiles.length} changed recipe file(s) to validate:`);
    changedFiles.forEach(f => console.log(` - ${f}`));

    const invalidFiles: string[] = [];
    for (const file of changedFiles) {
      const isValid = await validateSchema(file);
      if (!isValid) {
        invalidFiles.push(file);
      }
    }

    if (invalidFiles.length > 0) {
      console.error('\n❌ Validation failed for the following recipes:');
      invalidFiles.forEach(f => console.error(` - ${f}`));
      process.exit(1);
    } else {
      console.log('\n✅ All changed recipes are valid.');
      process.exit(0);
    }

  } catch (error) {
    console.error('An unexpected error occurred:', error);
    process.exit(1);
  }
}

main();
