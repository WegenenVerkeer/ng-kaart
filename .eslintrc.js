/*
  👋 Hi! This file was autogenerated by tslint-to-eslint-config.
  https://github.com/typescript-eslint/tslint-to-eslint-config

  It represents the closest reasonable ESLint configuration to this
  project's original TSLint configuration.

  We recommend eventually switching this configuration to extend from
  the recommended rulesets in typescript-eslint.
  https://github.com/typescript-eslint/tslint-to-eslint-config/blob/master/docs/FAQs.md

  Happy linting! 💖
  */
module.exports = {
  "env": {
    "browser": true,
    "node": true
  },
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "tsconfig.eslint.json",
    "sourceType": "module"
  },
  "plugins": [
    "eslint-plugin-immutable",
    "eslint-plugin-import",
    "eslint-plugin-prettier",
    "@typescript-eslint",
    "@angular-eslint"
  ],
  "rules": {
    "@angular-eslint/component-class-suffix": "error",
    "@angular-eslint/component-selector": [
      "error",
      {
        "type": "element",
        "prefix": "awv",
        "style": "kebab-case"
      }
    ],
    "@angular-eslint/directive-class-suffix": "error",
    "@angular-eslint/directive-selector": [
      "error",
      {
        "type": "attribute",
        "prefix": "awv",
        "style": "camelCase"
      }
    ],
    "@angular-eslint/no-input-rename": "error",
    "@angular-eslint/no-output-rename": "error",
    "@angular-eslint/use-pipe-transform-interface": "error",
    "@typescript-eslint/consistent-type-definitions": "error",
    "@typescript-eslint/dot-notation": "off",
    "@typescript-eslint/explicit-member-accessibility": [
      "off",
      {
        "accessibility": "explicit"
      }
    ],
    "@typescript-eslint/member-delimiter-style": [
      "error",
      {
        "multiline": {
          "delimiter": "semi",
          "requireLast": true
        },
        "singleline": {
          "delimiter": "semi",
          "requireLast": false
        }
      }
    ],
    "@typescript-eslint/member-ordering": "off", /* zetten we af om te verhinderen dat lokale private variabelen nog niet geinitialiseerd
    zijn als er functies opgeroepen worden bij member variable assignments */
    "@typescript-eslint/naming-convention": "off", /* zetten we at want te veel functies/variabelen die met een Hoofdletter beginnen */
    "@typescript-eslint/no-empty-function": "off",
    "@typescript-eslint/no-empty-interface": "error",
    "@typescript-eslint/no-inferrable-types": "error",
    "@typescript-eslint/no-unused-expressions": "error",
    "@typescript-eslint/prefer-function-type": "error",
    "@typescript-eslint/quotes": "off",
    "@typescript-eslint/semi": [
      "error",
      "always"
    ],
    "@typescript-eslint/type-annotation-spacing": "error",
    "@typescript-eslint/unified-signatures": "error",
    "arrow-parens": [
      "off",
      "always"
    ],
    "brace-style": [
      "error",
      "1tbs"
    ],
    "comma-dangle": "off",
    "curly": "error",
    "eol-last": "error",
    "eqeqeq": [
      "error",
      "smart"
    ],
    "guard-for-in": "error",
    "id-blacklist": "off",
    "id-match": "off",
    "import/no-deprecated": "warn",
    "import/order": "error",
    "linebreak-style": "off",
    "max-classes-per-file": [
      "off",
      1
    ],
    "max-len": [
      "error",
      {
        "code": 140
      }
    ],
    "new-parens": "off",
    "newline-per-chained-call": "off",
    "no-bitwise": "warn",
    "no-caller": "error",
    "no-console": [
      "error",
      {
        "allow": [
          "log",
          "warn",
          "dir",
          "timeLog",
          "assert",
          "clear",
          "count",
          "countReset",
          "group",
          "groupEnd",
          "table",
          "dirxml",
          "error",
          "groupCollapsed",
          "Console",
          "profile",
          "profileEnd",
          "timeStamp",
          "context"
        ]
      }
    ],
    "no-debugger": "error",
    "no-empty": "off",
    "no-eval": "error",
    "no-extra-semi": "off",
    "no-fallthrough": "error",
    "no-irregular-whitespace": "off",
    "no-multiple-empty-lines": "off",
    "no-new-wrappers": "error",
    "no-param-reassign": 2,
    "no-redeclare": "error",
    "no-restricted-imports": "error",
    "no-shadow": [
      "off",
      {
        "hoist": "all"
      }
    ],
    "no-throw-literal": "error",
    "no-trailing-spaces": "off",
    "no-underscore-dangle": "off",
    "no-unused-labels": "error",
    "no-var": "error",
    "prefer-const": "error",
    "prettier/prettier": "warn",
    "quote-props": "off",
    "radix": "error",
    "space-before-function-paren": "off",
    "space-in-parens": [
      "off",
      "never"
    ],
    "spaced-comment": [
      "warn",
      "always",
      {
        "markers": [
          "/"
        ]
      }
    ]
  }
};
