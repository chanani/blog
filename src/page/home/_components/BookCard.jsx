import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiChevronRight } from 'react-icons/fi';
import { BsStarFill, BsStarHalf, BsStar } from 'react-icons/bs';
import './BookCard.css';

function BookCard({ book, index }) {
  const [imgError, setImgError] = useState(false);

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => {
      const fill = rating - i >= 1 ? 'full' : rating - i >= 0.5 ? 'half' : 'empty';
      if (fill === 'full') return <BsStarFill key={i} size={11} className="star-full" />;
      if (fill === 'half') return <BsStarHalf key={i} size={11} className="star-half" />;
      return <BsStar key={i} size={11} className="star-empty" />;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
    >
      <Link to={`/book/${book.slug}`} className="book-card">
        <div className="book-cover-wrap">
          {book.cover && !imgError ? (
            <img
              src={book.cover}
              alt={book.title}
              className="book-cover-img"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="book-cover-fallback">
              <span className="fallback-emoji">&#128214;</span>
            </div>
          )}
        </div>

        <div className="book-card-info">
          <div className="book-title-row">
            <h3 className="book-title">{book.title}</h3>
            {book.status && (
              <span className={`book-status-badge status-${book.status}`}>
                {book.status}
              </span>
            )}
          </div>
          {book.subtitle && (
            <p className="book-subtitle">{book.subtitle}</p>
          )}

          <div className="book-meta">
            {book.author && <span>{book.author}</span>}
            {book.category && (
              <>
                <span className="book-category">{book.category}</span>
              </>
            )}
          </div>

          {book.rating > 0 && (
            <div className="book-rating">{renderStars(book.rating)}</div>
          )}

          {book.tags && book.tags.length > 0 && (
            <div className="book-tags">
              {book.tags.slice(0, 4).map((tag) => (
                <span key={tag} className="book-tag">#{tag}</span>
              ))}
            </div>
          )}
        </div>

        <FiChevronRight size={18} className="book-arrow" />
      </Link>
    </motion.div>
  );
}

export default BookCard;
