'use client'

import Link from 'next/link'
import Image from 'next/image'

const companyLinks = [
  { name: 'About us', href: '/tentang' },
  { name: 'Partner program', href: '/partnership' },
  { name: 'Career', href: '/career' },
  { name: 'Contact us', href: '/contact' },
  { name: 'Privacy Policy', href: '/privacy' },
]

const serviceLinks = [
  { name: 'Pricing', href: '/pricing' },
  { name: 'Reviews', href: '/reviews' },
  { name: 'Direct Mail Academy', href: '/academy' },
  { name: 'Success stories', href: '/success' },
  { name: 'Terms & conditions', href: '/terms' },
]

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Brand Section */}
          <div className="space-y-4">
            <Link href="/" className="inline-block">
              <Image
                src="/assets/branding/tunarasa_grey.png"
                alt="Tunarasa"
                width={280}
                height={100}
                className="h-28 w-auto opacity-80 transition-opacity hover:opacity-100"
              />
            </Link>
            <p className="max-w-sm text-sm text-gray-600">
              Platform Komunikasi Inklusif untuk Aksesibilitas Layanan Publik bagi Penyandang Tuna Rungu & Tuna Wicara
            </p>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="mb-4 text-sm font-semibold tracking-wider text-gray-900 uppercase">COMPANY</h3>
            <ul className="space-y-3">
              {companyLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-sm text-gray-600 transition-colors hover:text-blue-600">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Section */}
          <div>
            <h3 className="mb-4 text-sm font-semibold tracking-wider text-gray-900 uppercase">CONTACT</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <svg className="h-4 w-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                <span className="text-sm text-gray-600">support@postpilot.com</span>
              </div>
              <p className="text-sm text-gray-600">
                Printed with <span className="text-red-500">❤</span> at our facility in South Carolina.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-8 border-t border-gray-200 pt-8">
          <div className="flex flex-col items-center justify-between md:flex-row">
            <p className="text-sm text-gray-500">© 2025 Tunarasa. All rights reserved.</p>
            <div className="mt-4 flex space-x-6 md:mt-0">
              {serviceLinks.slice(0, 3).map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-sm text-gray-500 transition-colors hover:text-blue-600"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
