/**
 * Complex JavaScript sample for highlighting
 */
import { EventEmitter } from 'events';

const GLOBAL_CONSTANT = 42;

class ThemeValidator extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    this.regex = /^[a-z0-9-]+$/i;
  }

  /**
   * Validates a recipe object
   */
  async validate(recipe) {
    try {
      if (!recipe.id || typeof recipe.id !== 'string') {
        throw new Error('Invalid ID');
      }

      console.log(`Validating ${this.name}...`);
      
      const isValid = this.regex.test(recipe.id);
      this.emit('validation', { isValid, timestamp: Date.now() });

      return isValid;
    } catch (err) {
      console.error(`Error: ${err.message}`);
      return false;
    }
  }
}

const validator = new ThemeValidator('EmacsThemes');
validator.on('validation', (result) => {
  const { isValid } = result;
  console.log(`Result: ${isValid ? 'PASSED' : 'FAILED'}`);
});

const sampleRecipe = {
  id: 'zenburn-theme',
  tags: ['dark', 'low-contrast'],
  complexity: GLOBAL_CONSTANT
};

validator.validate(sampleRecipe);