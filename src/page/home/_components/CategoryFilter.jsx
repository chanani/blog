import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import './CategoryFilter.css';

function CategoryFilter({ categories, selected, onSelect }) {
  const { t } = useTranslation();

  return (
    <div className="category-filter">
      {categories.map((category) => (
        <motion.button
          key={category}
          className={`category-chip ${selected === category ? 'active' : ''}`}
          onClick={() => onSelect(category)}
          whileTap={{ scale: 0.95 }}
        >
          {category === 'all' ? t('reading.all') : category}
        </motion.button>
      ))}
    </div>
  );
}

export default CategoryFilter;
