import { redirect, json } from '@remix-run/cloudflare'
import { useLoaderData, useSubmit, NavLink } from '@remix-run/react'

import { Outlet } from '@remix-run/react'

import { BiCog, BiIdCard, BiLink } from 'react-icons/bi'
import { HiOutlineHome, HiOutlineViewGridAdd } from 'react-icons/hi'

import { getUserSession, requireJWT } from '~/utils/session.server'

import styles from '~/styles/account.css'

import { links as buttonStyles } from '~/components/base-button'
import { links as faqStyles } from '~/components/FAQ'
import { links as invCodeStyles } from '~/components/invite-code'
import { links as profileNftCollectionLinks } from '~/components/nft-collection/ProfileNftCollection'

import HeadNav from '~/components/head-nav'
import ConditionalTooltip from '~/components/conditional-tooltip'

import Text, {
  TextColor,
  TextSize,
  TextWeight,
} from '~/components/typography/Text'
import validateProof from '~/helpers/validate-proof'
import { getGalaxyClient } from '~/helpers/galaxyClient'

export function links() {
  return [
    ...invCodeStyles(),
    ...buttonStyles(),
    ...faqStyles(),
    ...profileNftCollectionLinks(),
    { rel: 'stylesheet', href: styles },
  ]
}

// @ts-ignore
export const loader = async ({ request }) => {
  const jwt = await requireJWT(request, '/auth')

  const session = await getUserSession(request)
  const address = session.get('address')
  const core = session.get('core')

  if (!(await validateProof(address))) {
    return redirect(`/auth/gate/${address}`)
  }

  // @ts-ignore
  const onboardData = await ONBOARD_STATE.get(core)
  if (!onboardData) {
    // @ts-ignore
    await ONBOARD_STATE.put(address, 'true')

    return redirect(`/onboard/name`)
  }

  const galaxyClient = await getGalaxyClient()
  const profileRes = await galaxyClient.getProfile(undefined, {
    'KBT-Access-JWT-Assertion': jwt,
  })

  // @ts-ignore
  const [avatarUrl, isToken] = [
    profileRes.profile?.pfp?.image,
    profileRes.profile?.pfp?.isToken,
  ]

  return json({
    address,
    avatarUrl,
    isToken,
  })
}

const subNavigation = [
  {
    name: 'Dashboard',
    href: '/account/dashboard',
    icon: HiOutlineHome,
    exists: true,
  },
  {
    name: 'NFT Gallery',
    href: '#',
    icon: HiOutlineViewGridAdd,
  },
  { name: 'KYC', href: '#', icon: BiIdCard },
  { name: 'Apps', href: '#', icon: BiLink },
  { name: 'Settings', href: 'settings', icon: BiCog, exists: true },
]

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

export default function AccountLayout() {
  const { address, avatarUrl, isToken } = useLoaderData()
  return (
    <>
      <div className="min-h-full">
        <div className="header lg:px-4">
          <HeadNav
            avatarUrl={avatarUrl}
            isToken={isToken}
            loggedIn={{ address }}
          />
        </div>

        <main className="-mt-72 pb-12">
          <div className="mx-auto max-w-screen-xl lg:px-4 md:px-4 pb-6 sm:px-6 lg:px-8 lg:pb-16">
            <div className="overflow-hidden bg-white shadow">
              <div className="divide-y divide-gray-200 lg:grid lg:grid-cols-12 lg:divide-y-0 lg:divide-x">
                <aside className="fixed bottom-0 z-50 w-full lg:relative lg:col-start-1 lg:col-end-3 bg-gray-50">
                  <nav className="flex flex-row justify-center items-center lg:flex-none lg:block lg:mt-8 space-y-1">
                    {subNavigation.map((item) => (
                      <SideNavItem key={item.name} item={item} />
                    ))}
                  </nav>
                </aside>
                <div className="divide-y divide-gray-200 px-4 sm:mb-16 lg:col-start-3 lg:col-end-13 lg:p-4 lg:p-8">
                  <Outlet />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}

type SideNavItemProps = {
  item: {
    name: string
    href: string
    icon: any
    exists?: boolean
  }
}

const SideNavItem = ({ item }: SideNavItemProps) => {
  const activeStyle = {
    backgroundColor: 'rgb(243 244 246)',
  }
  return (
    <div className={'basis-1/4 lg:w-100 content-center self-center z-50'}>
      <NavLink
        to={item.href}
        // @ts-ignore
        style={({ isActive }) => {
          return isActive && item.href != '#' ? activeStyle : undefined
        }}
        className="text-sm group lg:border-l-4 px-4 py-4 flex self-center justify-center items-center flex-row lg:justify-start lg:items-start"
      >
        <item.icon
          className={classNames(
            !item.exists && 'opacity-25 cursor-not-allowed',
            'text-sm flex-shrink-0 -ml-1 lg:mr-3 h-6 w-6 self-center'
          )}
          style={{
            color: '#4B5563',
          }}
          aria-hidden="true"
        />

        <ConditionalTooltip content="Coming Soon" condition={!item.exists}>
          <span
            className={classNames(
              !item.exists && 'opacity-25 cursor-not-allowed',
              'hidden lg:block self-center'
            )}
          >
            <Text
              className="truncate self-center"
              size={TextSize.SM}
              weight={TextWeight.Medium500}
              color={TextColor.Gray600}
            >
              {item.name}
            </Text>
          </span>
        </ConditionalTooltip>
      </NavLink>
    </div>
  )
}
