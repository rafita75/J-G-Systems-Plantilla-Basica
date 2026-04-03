// client/src/pages/Admin/ProductForm.jsx
import { useState } from 'react';
import { createProduct, updateProduct } from '../../../shared/services/productService';
import Button from '../../core/components/UI/Button';
import Input from '../../core/components/UI/Input';

export default function ProductForm({ product, categories, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price || '',
    stock: product?.stock || '',
    categoryId: product?.categoryId?._id || '',
    sku: product?.sku || '',
    isFeatured: product?.isFeatured || false,
    thumbnail: product?.thumbnail || '',
    images: product?.images || []
  });
  const [imageUrls, setImageUrls] = useState(() => {
    if (product?.images?.length) {
      return product.images.map(img => img.url).join('\n');
    }
    return '';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const urls = imageUrls.split('\n').filter(url => url.trim());
    const imagesArray = urls.map((url, index) => ({
      url: url.trim(),
      alt: formData.name,
      order: index
    }));
    
    const submitData = {
      ...formData,
      images: imagesArray,
      thumbnail: formData.thumbnail || (imagesArray[0]?.url || '')
    };
    
    try {
      if (product) {
        await updateProduct(product._id, submitData);
      } else {
        await createProduct(submitData);
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar producto');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="bg-white rounded-2xl shadow-soft p-6 animate-fade-in">
      <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
        {product ? '✏️ Editar Producto' : '➕ Nuevo Producto'}
      </h3>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Nombre *"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            placeholder="Ej: Camiseta Premium"
            required
            icon="📦"
          />
          
          <Input
            label="SKU (código único)"
            name="sku"
            type="text"
            value={formData.sku}
            onChange={handleChange}
            placeholder="Ej: CAM-001"
            icon="🔢"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows="5"
            placeholder="Describe el producto..."
            required
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Precio *"
            name="price"
            type="number"
            value={formData.price}
            onChange={handleChange}
            placeholder="0.00"
            required
            step="0.01"
            icon="💰"
          />
          
          <Input
            label="Stock *"
            name="stock"
            type="number"
            value={formData.stock}
            onChange={handleChange}
            placeholder="0"
            required
            icon="📊"
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
            <select
              name="categoryId"
              value={formData.categoryId}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              <option value="">Sin categoría</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Múltiples imágenes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Imágenes del producto (una URL por línea)
          </label>
          <textarea
            value={imageUrls}
            onChange={(e) => setImageUrls(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
            rows="4"
            placeholder="https://ejemplo.com/imagen1.jpg
https://ejemplo.com/imagen2.jpg
https://ejemplo.com/imagen3.jpg"
          />
          <p className="text-xs text-gray-500 mt-1">
            💡 La primera imagen será usada como miniatura
          </p>
          
          {/* Vista previa de imágenes */}
          {imageUrls && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Vista previa:</p>
              <div className="flex gap-2 flex-wrap">
                {imageUrls.split('\n').filter(url => url.trim()).map((url, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={url.trim()}
                      alt={`Preview ${idx + 1}`}
                      className="w-20 h-20 object-cover rounded-xl border-2 border-gray-200 group-hover:border-primary-500 transition"
                      onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/80?text=Error';
                      }}
                    />
                    {idx === 0 && (
                      <span className="absolute -top-2 -right-2 bg-primary-600 text-white text-xs rounded-full px-1.5 py-0.5 shadow-soft">
                        Principal
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Miniatura personalizada */}
        <Input
          label="Miniatura personalizada (opcional)"
          name="thumbnail"
          type="text"
          value={formData.thumbnail}
          onChange={handleChange}
          placeholder="https://ejemplo.com/miniatura.jpg"
          icon="🖼️"
          helper="Si no especificas, se usará la primera imagen de la lista"
        />
        
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
          <input
            type="checkbox"
            name="isFeatured"
            id="isFeatured"
            checked={formData.isFeatured}
            onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
            className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
          />
          <label htmlFor="isFeatured" className="text-sm text-gray-700 cursor-pointer">
            ⭐ Producto destacado (aparecerá en la sección de destacados)
          </label>
        </div>
        
        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="flex-1"
          >
            {product ? 'Actualizar Producto' : 'Crear Producto'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}