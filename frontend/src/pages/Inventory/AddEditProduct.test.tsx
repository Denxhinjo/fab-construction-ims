import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AddEditProduct from './AddEditProduct'
import type { Product } from '../../types'

const product: Product = {
  id: 1, name: 'Cement bag', quantity: 42, unit: 'bags', min_stock_level: 5,
  status: 'active', is_low_stock: false, created_at: '', updated_at: '',
}

vi.mock('../../services/api', () => ({
  productsApi: { get: vi.fn(() => Promise.resolve({ data: product })) },
  categoriesApi: { list: vi.fn(() => Promise.resolve({ data: [] })) },
  locationsApi: { list: vi.fn(() => Promise.resolve({ data: [] })) },
  suppliersApi: { list: vi.fn(() => Promise.resolve({ data: [] })) },
  uploadsApi: { image: vi.fn() },
  mediaUrl: (path: string | null | undefined) => path ?? undefined,
}))

function renderForm(path: string, route: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={<AddEditProduct />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// The quantity field shares its default "0" value with min-stock-level, so
// scope the query to the "Current Quantity" FormField instead of matching
// by display value alone.
function getQuantityInput() {
  const label = screen.getByText('Current Quantity')
  return label.closest('div')!.querySelector('input') as HTMLInputElement
}

// Locks in the audit finding: quantity is only ever set at product creation.
// Once a product exists, quantity changes must go through a stock-movement
// entry (Stock In/Out/Adjustment) instead of a silent form overwrite.
describe('AddEditProduct quantity field', () => {
  it('is editable when creating a new product', () => {
    renderForm('/inventory/new', '/inventory/new')
    expect(getQuantityInput()).not.toBeDisabled()
  })

  it('is disabled when editing an existing product', async () => {
    renderForm('/inventory/1/edit', '/inventory/:id/edit')
    await waitFor(() => expect(getQuantityInput().value).toBe('42'))
    expect(getQuantityInput()).toBeDisabled()
  })
})
