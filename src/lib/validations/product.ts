/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Product name must be at least 2 characters.')
    .max(120, 'Product name cannot exceed 120 characters.'),
  description: z
    .string()
    .trim()
    .max(1000, 'Description cannot exceed 1000 characters.')
    .optional()
    .or(z.literal('')),
  price: z
    .number()
    .positive('Price must be greater than zero.')
    .refine(
      (val) => Math.round(val * 100) === val * 100,
      'Price cannot have more than 2 decimal places.'
    ),
  currency: z.string().default('KES'),
  sku: z
    .string()
    .trim()
    .max(50, 'SKU cannot exceed 50 characters.')
    .optional()
    .or(z.literal('')),
  image_url: z
    .string()
    .trim()
    .refine(
      (val) => !val || val.startsWith('http://') || val.startsWith('https://'),
      'Image URL must start with http:// or https://'
    )
    .optional()
    .or(z.literal('')),
  status: z.enum(['active', 'archived']).default('active'),
});

export type ProductFormValues = z.infer<typeof productSchema>;
